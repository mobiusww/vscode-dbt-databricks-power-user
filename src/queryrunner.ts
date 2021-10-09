import * as vscode from "vscode";
import { BigQuery, Job, BigQueryOptions } from "@google-cloud/bigquery";
import * as flatten from "flat";

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

export class BigQueryRunner {
  config: vscode.WorkspaceConfiguration;
  client: BigQuery;
  job: Job | null = null;
  editor: vscode.TextEditor;

  constructor(config: vscode.WorkspaceConfiguration, editor: vscode.TextEditor) {
    this.config = config;
    this.editor = editor;
    let options: BigQueryOptions = {
      keyFilename: this.config?.get("keyFilename"),
      projectId: this.config?.get("projectId"),
    };
    this.client = new BigQuery(options);
  }

  setConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
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

  public async runAsQuery(variables: { [s: string]: any }, onlySelected?: boolean): Promise<QueryResult | QueryResultError> {
    try {
      console.log(`BigQueryRunner.runAsQuery.variables: ${variables}`);
      const queryText = this.getQueryText(variables, onlySelected);
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

  private getQueryText(variables: { [s: string]: any }, onlySelected?: boolean): string {
    if (!this.editor) {
      throw new Error("No active editor window was found");
    }

    let text: string;

    // Only return the selected text
    if (onlySelected) {
      const selection = this.editor.selection;
      if (selection.isEmpty) {
        throw new Error("No text is currently selected");
      }

      text = this.editor.document.getText(selection).trim();
    } else {
      text = this.editor.document.getText().trim();
    }

    if (!text) {
      throw new Error("The editor window is empty");
    }

    // Replace variables
    for (let [key, value] of Object.entries(variables)) {
      const re = new RegExp(key, 'g');
      text = text.replace(re, value);
    }

    return text;
  }



}

