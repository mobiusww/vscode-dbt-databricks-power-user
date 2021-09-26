import {
  window,
  workspace,
  TextEditor,
  ExtensionContext,
  commands as vscode_commands,
  WorkspaceConfiguration,

} from "vscode";

import {
  BigQuery,
  BigQueryOptions,
} from "@google-cloud/bigquery";
import toCSV = require("csv-stringify");
import EasyTable = require("easy-table");
import flatten = require("flat");
const configPrefix = "bigquery";
let config: WorkspaceConfiguration | undefined;
let output = window.createOutputChannel("BigQuery");

type CommandMap = Map<string, () => void>;
let commands: CommandMap = new Map<string, () => void>([
  ["extension.runAsQuery", runAsQuery]
  // ["extension.runSelectedAsQuery", runSelectedAsQuery],
  // ["extension.dryRun", dryRun]
]);

function readConfig(): WorkspaceConfiguration {
  try {
    return workspace.getConfiguration(configPrefix);
  } catch (e) {
    window.showErrorMessage(`failed to read config: ${e}`);
    throw new Error(`Failed to read config with prefix ${configPrefix}`);

  }
}
export async function activate(ctx: ExtensionContext): Promise<void>  {
  config = readConfig();

  // Register all available commands and their actions.
  commands.forEach((action, name) => {
    ctx.subscriptions.push(vscode_commands.registerCommand(name, action));
  });

  // Listen for configuration changes and trigger an update, so that users don't
  // have to reload the VS Code environment after a config update.
  ctx.subscriptions.push(
    workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration(configPrefix)) {
        return;
      }

      config = readConfig();
    })
  );
}


export function runAsQueryText(queryText: string): void {
  if (!queryText) {
    window.showErrorMessage("Query text is empty");
    return;
  }
  console.log("Invoking run query");
  try {
    query(queryText, false); // set dry-run to true
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }
}

function runAsQuery(): void {
  try {
    let queryText = getQueryText(window.activeTextEditor);
    query(queryText);
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }
}

function getQueryText(
  editor: TextEditor | undefined,
  onlySelected?: boolean
): string {
  if (!editor) {
    throw new Error("No active editor window was found");
  }

  // Only return the selected text
  if (onlySelected) {
    let selection = editor.selection;
    if (selection.isEmpty) {
      throw new Error("No text is currently selected");
    }

    return editor.document.getText(selection).trim();
  }

  let text = editor.document.getText().trim();
  if (!text) {
    throw new Error("The editor window is empty");
  }

  return text;
}


/**
 * @param queryText
 * @param isDryRun Defaults to False.
 */
function query(queryText: string, isDryRun?: boolean): Promise<any> {
  let options: BigQueryOptions; 
  let x = {
   keyFilename: config?.get("keyFilename"),
    projectId: config?.get("projectId"),
    email: config?.get("email")   
  };
  // init options here
  // let client = new BigQuery(options);
  let client = new BigQuery();

  let id: string;
  let job = client
    .createQueryJob({
      query: queryText,
      location: config?.get("location"),
      maximumBytesBilled: config?.get("maximumBytesBilled"),
      useLegacySql: config?.get("useLegacySql"),
      dryRun: !!isDryRun
    })
    .then(data => {
      let job = data[0];
      let id = job.id;
      const jobIdMessage = `BigQuery job ID: ${job.id}`;
      if (isDryRun) {
        window.showInformationMessage(`${jobIdMessage} (dry run)`);
        let totalBytesProcessed = job.metadata.statistics.totalBytesProcessed;
        writeDryRunSummary(`${id}`, totalBytesProcessed);
        return null;
      }
      window.showInformationMessage(jobIdMessage);

      return job.getQueryResults({
        autoPaginate: true
      });
    })
    .catch(err => {
      window.showErrorMessage(`Failed to query BigQuery: ${err}`);
      return null;
    });

  return job
    .then(data => {
      if (data) {
        writeResults(id, data[0]);
      }
    })
    .catch(err => {
      window.showErrorMessage(`Failed to get results: ${err}`);
    });
}

function writeResults(jobId: string, rows: Array<any>): void {
  output.show();
  output.appendLine(`Results for job ${jobId}:`);

  let format:string|undefined = config?.get("outputFormat");
  if(!format) {
    format = "csv";
  }
  
  format = format.toLowerCase();

  switch (format) {
    case "csv":
      toCSV(rows, (err, res) => {
        if (err) {
          console.log(`${err}`);
        } else {
          output.appendLine(res);
        }
      });

      break;
    case "table":
      let t = new EasyTable();

      // Collect the header names; flatten nested objects into a
      // recordname.recordfield format
      let headers: any[] = [];
      Object.keys(flatten(rows[0])).forEach(name => headers.push(name));

      rows.forEach((val, idx) => {
        // Flatten each row, and for each header (name), insert the matching
        // object property (v[name])
        let v = flatten(val, { safe: true });
        headers.forEach((name, col) => {
          t.cell(name, val[name]);
        });
        t.newRow();
      });

      output.appendLine(t.toString());

      break;
    default:
      let spacing = config?.get("prettyPrintJSON") ? "  " : "";
      rows.forEach(row => {
        output.appendLine(
          JSON.stringify(flatten(row, { safe: true }), null, spacing)
        );
      });
  }
}

function writeDryRunSummary(jobId: string, numBytesProcessed: string) {
  output.show();
  output.appendLine(`Results for job ${jobId} (dry run):`);
  output.appendLine(`Total bytes processed: ${numBytesProcessed}`);
  output.appendLine(``);
}
