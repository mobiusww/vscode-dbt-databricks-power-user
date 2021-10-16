import * as vscode from "vscode";
import { BigQuery, Job, BigQueryOptions } from "@google-cloud/bigquery";
import * as flatten from "flat";
import { DBTProjectContainer } from "./manifest/dbtProjectContainer";
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
  dbtProjectContainer: DBTProjectContainer | undefined;
  constructor(config: vscode.WorkspaceConfiguration, editor: vscode.TextEditor) {
    this.config = config;
    this.editor = editor;
    let options: BigQueryOptions = {
      keyFilename: this.config?.get("keyFilename"),
      projectId: this.config?.get("projectId"),
    };
    this.client = new BigQuery(options);
    // get project root and target path
    // const dbtPowerUserExtension = container.get(DBTPowerUserExtension);
    // this.dbtProjectContainer = dbtPowerUserExtension.getDbtProjectContainer();

  }
  setDbtProjectContainer(dbtProjectContainer: DBTProjectContainer) {
    this.dbtProjectContainer = dbtProjectContainer;
  }
  findTargetPath(docUri: vscode.Uri):string {
    if (!this.dbtProjectContainer) {
      throw new Error("dbtProjectContainer not initialized for runner!");
    }
    const dbtProject = this.dbtProjectContainer.findDBTProject(docUri);
    if (!dbtProject) {
      throw new Error(`couldn't find DBT Project for ${docUri}`);
    }
    return dbtProject.getTargetPath();
  }
  findProjectRoot(docUri: vscode.Uri): vscode.Uri {
    if (!this.dbtProjectContainer) {
      throw new Error("dbtProjectContainer not initialized for runner!");
    }
    const dbtProject = this.dbtProjectContainer.findDBTProject(docUri);
    if (!dbtProject) {
      throw new Error(`couldn't find DBT Project for ${docUri}`);
    } 
    return dbtProject.projectRoot;   
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

  public async runAsQuery(): Promise<QueryResult | QueryResultError> {
    try {
      console.log(`BigQueryRunner.runAsQuery`);
      const queryText = await this.getQueryText();
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
  private isCompiled(docUri: vscode.Uri): boolean {
    // TODO: for impl
    if (!this.dbtProjectContainer) {
      throw new Error("dbtProjectContainer not initialized for runner!");
    }
    const dbtProject = this.dbtProjectContainer.findDBTProject(docUri);
    if (!dbtProject) {
      // if not part of dbt project, assume compiled is true
      return true;
    }
    return dbtProject.isCompiled(docUri);
  }
  private async findCompiledSQLText(docUri: vscode.Uri): Promise<string | undefined>  {
    if (!this.dbtProjectContainer) {
      throw new Error("dbtProjectContainer not initialized for runner!");
    }    
    const dbtProject = this.dbtProjectContainer.findDBTProject(docUri);
    if (!dbtProject) {
      // if not part of dbt project, assume compiled is true
      throw new Error('something went wrong with file lookup');
    }    
    return dbtProject.getCompiledSQLText(docUri);
  }
  private async getQueryText(): Promise<string> {
    if (!this.editor) {
      throw new Error("No active editor window was found");
    }
    console.log(`queryRunner.getQueryText.docURI.path: ${this.editor.document.uri.path}`);
    const compiled = this.isCompiled(this.editor.document.uri);
    let text: string | undefined;
    if (compiled) {
      text = this.editor.document.getText().trim(); 
    } else {
      // TODO: check if docuri update time is later than what
      // was previously run or if compiled sql text was not in 
      // sync with uncompiled sql - if uncompiled sql is not
      // in sync - trigger compilation and use compiled text
      text = await this.findCompiledSQLText(this.editor.document.uri);
      if (!text) {
        throw new Error("No compiled SQL found!");
      }
    }

    if (!text) {
      throw new Error("The editor window is empty");
    }
    return text;
  }



}

