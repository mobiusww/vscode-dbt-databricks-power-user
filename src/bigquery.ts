import *  as fs from "fs";
import {
  window,
  workspace,
  ExtensionContext,
  commands as vscode_commands,
  WorkspaceConfiguration,
  TextEditor,
  OutputChannel,

} from "vscode";

import {
  BigQuery,
  BigQueryOptions,
} from "@google-cloud/bigquery";
import toCSV = require("csv-stringify");
import EasyTable = require("easy-table");
import flatten = require("flat");
import { PathLike } from "fs";
import { DBTProjectContainer } from "./manifest/dbtProjectContainer";
import { DBTPowerUserExtension } from './dbtPowerUserExtension';
const configPrefix = "dbt.bigquery";
let config: WorkspaceConfiguration | undefined;
let vsdbtProjectContainer: DBTProjectContainer;

let inner_output = window.createOutputChannel("BigQuery");

type CommandMap = Map<string, () => void>;

let commands: CommandMap = new Map<string, () => void>([
  ["dbtPowerUser.querySQLResult", runAsQuery],
  ["dbtPowerUser.querySQLDryRun", dryRun]
]);


function readConfig(): WorkspaceConfiguration {
  try {
    return workspace.getConfiguration(configPrefix);
  } catch (e) {
    window.showErrorMessage(`failed to read config: ${e}`);
    throw new Error(`Failed to read config with prefix ${configPrefix}`);

  }
}
export async function activate(ctx: ExtensionContext, dbtPowerUserExtension: DBTPowerUserExtension): Promise<void> {
  config = readConfig();
  vsdbtProjectContainer = dbtPowerUserExtension.getDbtProjectContainer();
  // Register all available commands and their actions.
  commands.forEach((action, name) => {
    ctx.subscriptions.push(vscode_commands.registerCommand(name, action));
  });
  ctx.subscriptions.push(
    workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration(configPrefix)) {
        return;
      }

      config = readConfig();
    })
  );
}

function getQueryText(editor: TextEditor | undefined): string {
  if (!editor) {
    throw new Error("No active editor window was found");
  }
  console.log(`bigquery.getQueryText.docURI.path: ${editor.document.uri.path}`);
  let text = editor.document.getText().trim();
  if (!text) {
    throw new Error("The editor window is empty");
  }

  return text;
}

async function runAsQuery(): Promise<void> {
  try {
    let queryText = getQueryText(window.activeTextEditor);
    const docURI = window.activeTextEditor?.document.uri;
    console.log(`runAsQuery.docURI: ${docURI}`);
    const root_path = docURI !== undefined ? vsdbtProjectContainer.getProjectRootpath(docURI)?.path : undefined;
    const format: any = config?.get("outputFormat");
    await query(queryText, false, root_path, format);
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }
}

async function dryRun(): Promise<void> {
  try {
    let queryText = getQueryText(window.activeTextEditor);
    await query(queryText, true);
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }
}



function makeid(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() *
      charactersLength));
  }
  return result;
}

function getResultsFileName(root_path?: string, format?: string | undefined): string | undefined {
  if (!format) {
    format = config?.get("outputFormat");
  }
  if (!format) {
    format = "csv";
  }
  if (format.toLowerCase() === "table") {
    format = "txt";
  }
  const ext = format.toLowerCase();
  console.log(`output file ext: ${ext}`);

  if (!root_path) {
    return;
  }
  const dir_prefix = root_path + "/logs/results";
  if (!fs.existsSync(dir_prefix)) {
    fs.mkdirSync(dir_prefix, { recursive: true });
  }
  console.log(`output dir prefix ${dir_prefix}`);
  if (!fs.existsSync(dir_prefix)) {
    window.showErrorMessage(`Could not create query results dir ${dir_prefix}`);
    return;
  }
  const d = new Date();

  const randsuffix = makeid(8);
  const fname = `query-results-${d.getFullYear()}${d.getMonth()}${d.getDate()}-${d.getHours()}${d.getMinutes()}${d.getSeconds()}-${randsuffix}`;
  console.log(`output fname: ${fname}`);
  const fileName = dir_prefix + "/" + fname + "." + ext; // come up with something that is in logs
  console.log(`output filename: ${fileName}`);
  return fileName;

}

/**
 * @param queryText
 * @param isDryRun Defaults to False.
 */
export async function query(queryText: string, isDryRun?: boolean, root_path?: string, format?: string): Promise<any> {


  let options: BigQueryOptions = {
    keyFilename: config?.get("keyFilename"),
    projectId: config?.get("projectId"),
  };

  let client = new BigQuery(options);
  const fileName = getResultsFileName(root_path, format);
  console.log(`bigquery.fileName: ${fileName}`);
  let id: string | undefined;
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
      id = job.id;
      console.log(`running client job id: ${job.id}`);
      const jobIdMessage = `BigQuery job ID: ${job.id} file: ${fileName}`;
      if (isDryRun) {
        window.showInformationMessage(`${jobIdMessage} (dry run)`);
        let totalBytesProcessed = job.metadata.statistics.totalBytesProcessed;
        writeDryRunSummary(inner_output, `${id}`, totalBytesProcessed);
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
    .then(async data => {
      if (!format) {
        format = config?.get("outputFormat");
      }

      if (!format) {
        format = "csv";
      }

      if (data) {
        await writeResults(fileName, id, data[0], format);
      }
    })
    .catch(err => {
      window.showErrorMessage(`Failed to get results: ${err}`);
    });
}

async function writeResults(fileName: PathLike | undefined, jobId: string | undefined, rows: Array<any>, format: string): Promise<void> {
  inner_output.show();
  inner_output.appendLine(`Results for job ${jobId}:`);

  format = format.toLowerCase();

  let headers: any[] = [];
  Object.keys(flatten(rows[0],)).forEach(name => headers.push(name));
  console.log(`Table Headers: ${JSON.stringify(headers)}`);

  function doRowOp(rs: typeof rows,
    rval: () => void,
    fval: (colname: string, val: any) => void): void {
    rs.forEach((row, idx) => {
      // Flatten each row, and for each header (name), insert the matching
      // object property (v[name])
      const v: any = flatten(row, { safe: true });
      const m = new Map(Object.entries(v));
      headers.forEach((name) => {
        fval(name, m.get(name));
      });
      rval();
    });

  }
  switch (format) {
    case "csv":
      let rs: any[] = [];
      rows.forEach((row) => {
        const v: any = flatten(row, { safe: true });
        rs.push(v);
      });
      toCSV(rs, { header: true }, async (err, res) => {
        if (err) {
          console.log(`CSV conversion error: ${err}`);
          return;
        }
        inner_output.appendLine(res);
        if (fileName) {
          await fs.promises.appendFile(fileName, res + "\n");
        }
      });

      break;
    case "table":
      let t = new EasyTable();
      doRowOp(rows, () => {
        t.newRow();
      }, (colname, val) => {
        t.cell(colname, val);
      });

      inner_output.appendLine(t.toString());
      if (fileName) {
        await fs.promises.appendFile(fileName, t.toString() + "\n");
      }
      break;
    default:
      let spacing = config?.get("prettyPrintJSON") ? "  " : "";
      if (fileName) {
        await fs.promises.appendFile(fileName, "[\n");
      }
      inner_output.appendLine("[");

      rows.forEach(async row => {
        const result = JSON.stringify(flatten(row, { safe: true }), null, spacing);
        inner_output.appendLine(result + ",");
        if (fileName) {
          await fs.promises.appendFile(fileName, result + ",\n");
        }
      });
      if (fileName) {
        await fs.promises.appendFile(fileName, "]\n");
      }
      inner_output.appendLine("]");
  }
}

function writeDryRunSummary(output: OutputChannel, jobId: string, numBytesProcessed: string) {
  output.show();
  output.appendLine(`Results for job ${jobId} (dry run):`);
  output.appendLine(`Total bytes processed: ${numBytesProcessed}`);
  output.appendLine(``);
}
