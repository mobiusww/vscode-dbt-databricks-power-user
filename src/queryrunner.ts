import * as vscode from "vscode";
import {
  workspace,
  RelativePattern,
} from "vscode";


import { BigQuery, Job, BigQueryOptions } from "@google-cloud/bigquery";
import * as flatten from "flat";
import { readFile, readFileSync } from "fs";
import path = require("path");

interface QueryResult {
  status: "success";
  sql?: string;
  info: { [s: string]: any };
  table: TableResult;
  json: string;
  detail: string;
}

interface QueryResultError {
  status: "error";
  errorMessage: string;
}

interface TableResult {
  headers: string[];
  rows: any[];
}
async function getCompiledTargetPath(modelPath:vscode.Uri, targetPath?:string, projectRoot?: vscode.Uri): Promise<vscode.Uri> {
    const baseName = path.basename(modelPath.fsPath);
    const pattern = `${targetPath}/compiled/**/${baseName}`;
    // console.log(`getCompiledTargetPath: looking for ${pattern}`);
    if (!projectRoot) {
      return modelPath;
    }
    const targetModels = await workspace.findFiles(
      new RelativePattern(
        projectRoot,
        pattern
      )
    );
    if (targetModels.length > 0) {
      const targetModel0 = targetModels[0];
      console.log(`getCompiledTargetPath: found targetModel0 ${targetModel0}`);
      return targetModel0;
    }
    console.log(`getCompiledTargetPath: returning original modelpath ${modelPath}`);
    return modelPath;
  }

export class BigQueryRunner {
  config: vscode.WorkspaceConfiguration;
  client: BigQuery;
  targetPath: string | null = null;
  projectRoot : vscode.Uri| null = null;
  job: Job | null = null;
  editor: vscode.TextEditor;
  compiled: boolean = true;
  constructor(config: vscode.WorkspaceConfiguration, editor: vscode.TextEditor) {
    this.config = config;
    this.editor = editor;
    let options: BigQueryOptions = {
      keyFilename: this.config?.get("keyFilename"),
      projectId: this.config?.get("projectId"),
    };
    this.client = new BigQuery(options);
  }
  setEditor(editor: vscode.TextEditor) {
    this.editor = editor;
  }
  setConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
  }
  setProjectRoot(projectRoot: vscode.Uri) {
    this.projectRoot = projectRoot;
  }
  setTargetPath(targetPath: string) {
    this.targetPath = targetPath;
  }
  /**
   * @param queryText
   * @param isDryRun Defaults to False.
   */
  private async query(queryText: string, isDryRun?: boolean): Promise<QueryResult> {
    let data;
    console.log(`queryrunner run query: queryText: ${queryText}`);
    try {
      data = await this.client.createQueryJob({
        query: queryText,
        dryRun: !!isDryRun
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to query BigQuery: ${err}`);
      throw err;
    }
    this.job = data[0];

    if (!this.job) {
      throw new Error("No job was found.");
    }

    vscode.window.showInformationMessage(`BigQuery job ID: ${this.job.metadata.id}`);

    let result;

    try {
      result = await this.job.getQueryResults({
        autoPaginate: true // TODO
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to query BigQuery: ${err}`);
      throw err;
    }

    try {
      return await this.processResults(result[0]);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to get results: ${err}`);
      throw err;
    }
  }

  private makeTable(rows: Array<any>): TableResult {
    const headers: string[] = [];
    Object.keys(flatten(rows[0], { safe: true })).forEach(name => headers.push(name));

    let table: any[] = [];

    rows.forEach((val, idx) => {
      // Flatten each row, and for each header (name), insert the matching
      // object property (v[name])
      let v: { [s: string]: any } = flatten(val, { safe: true });
      let tableRow: any[] = [];
      headers.forEach((name, col) => {
        tableRow.push(v[name]);
      });
      table.push(tableRow);
    });

    return {
      headers,
      rows: table
    };
  }

  private async processResults(rows: Array<any>): Promise<QueryResult> {
    if (!this.job) {
      throw new Error('No job was found.');
    }

    const metadata = (await this.job.getMetadata())[0];

    return {
      status: "success",
      info: {
        projectId: metadata.jobReference.projectId,
        jobId: metadata.id,
        location: this.job.location,
        jobLink: metadata.selfLink,
        creationTime: metadata.statistics.creationTime,
        startTime: metadata.statistics.startTime,
        endTime: metadata.statistics.endTime,
        userEmail: metadata.user_email,
        totalBytesProcessed: metadata.statistics.totalBytesProcessed,
        status: metadata.status.state,
      },
      table: this.makeTable(rows),
      json: JSON.stringify(rows, null, "  "),
      detail: JSON.stringify(metadata.statistics, null, "  "),
    };
  }

  public async runAsQuery(compile?: boolean): Promise<QueryResult | QueryResultError> {
    try {
      const queryText = await this.getQueryText(compile);
      console.log(`BigQueryRunner.runAsQuery.queryText:  ${queryText}`);
      let queryResult = await this.query(queryText);
      console.log(`BigQueryRunner.runAsQuery.queryResult: ${queryResult}`);
      queryResult.sql = queryText;
      return queryResult;
    } catch (err) {
      console.log(`BiqQueryRunner.runAsQuery.catcherr: ${err}`);
      vscode.window.showErrorMessage(`${err}`);
      return {
        status: "error",
        errorMessage: (err instanceof Error)? err.message:'',
      };
    }
  }

  public async cancelQuery(): Promise<any> {
    if (!this.job) {
      vscode.window.showErrorMessage('No job was found.');
      return;
    }

    const result = await this.job.cancel();
    return result;
  }

private async getQueryText(compile?: boolean): Promise<string> {
    if (!this.editor) {
      throw new Error("No active editor window was found");
    }

    let text: string;
    if (compile) {
      // get compiled version
      // grab from targetPath
      // this.editor.document.uri;
      let docUri = this.editor.document.uri;
      let targetPath = this.targetPath? this.targetPath: "";
      let projectRoot = this.projectRoot? this.projectRoot: docUri;
      let compiledTarget = await getCompiledTargetPath(docUri, targetPath, projectRoot);
      let compiledPath = compiledTarget.path;
      let querytext = readFileSync(compiledPath);
      // xlate document uri to compiled version
      // open file and read text
      text = querytext.toString();
    } else {
      text = this.editor.document.getText().trim();
    }

    if (!text) {
      throw new Error("The editor window is empty");
    }

    return text;
  }



}

