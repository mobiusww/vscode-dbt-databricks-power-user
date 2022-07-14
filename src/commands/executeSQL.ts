import path = require("path");
import { Disposable, window } from "vscode";
import { NodeMetaMap } from "../domain";
import { DBTProjectContainer } from "../manifest/dbtProjectContainer";
import { ManifestCacheChangedEvent } from "../manifest/event/manifestCacheChangedEvent";
import { QueryView } from "../query_view";
import { provideSingleton } from "../utils";
import * as vscode from 'vscode';
import { RunModel } from "./runModel";
import { TimeLogger } from "../utils";


import { DBTTerminal } from "../dbt_client/dbtTerminal";

@provideSingleton(ExecuteSQL)
export class ExecuteSQL {
  private disposables: Disposable[] = [];
  private modelToFQNMap: Map<string, NodeMetaMap> = new Map();

  constructor(private dbtProjectContainer: DBTProjectContainer, private queryView: QueryView, private terminal: DBTTerminal, private runModel: RunModel,) {
    this.disposables.push(
      dbtProjectContainer.onManifestChanged((event) =>
        this.onManifestCacheChanged(event)
      )
    );
  }

  async executeSQL() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      // TODO: get sql qualified name from graph
      const dbtProject = this.dbtProjectContainer.findDBTProject(fullPath);
      if (dbtProject === undefined) {
        return;
      }
      const nodeMap = this.modelToFQNMap.get(dbtProject.projectRoot.fsPath);
      if (nodeMap === undefined) {
        return;
      }
      const name = path.basename(fullPath.fsPath).slice(0, -4);
      const node = nodeMap.get(name);
      if (node === undefined) {
        return;
      }
      let fqn = "";
      if (node.database) {
        fqn += `${node.database}.`;
      }
      fqn += `${node.schema}.${node.alias}`;
      var timeLogger = new TimeLogger(this.terminal);
      
      const sql = `SELECT * FROM ${fqn} LIMIT 25`;
      timeLogger.f_tic(`Set the SQL to '${sql}'`);
      this.terminal.log(`Note: this operation will only work if the table/view has been created`);

      const data = await this.dbtProjectContainer.executeSQL(dbtProject.projectRoot, sql);
      if (data.length > 0) {
        timeLogger.f_toc(`Printing results to a new Execute Query window...`);
        this.queryView.createWebviewPanel(sql, data);
      }
      else {
        timeLogger.f_toc(`No data returned`);
      }
      
    }
  }


  async previewCurrentModel() {



    // todo compile first
    await this.runModel.async_compileModelOnActiveWindow();


    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {

      const dbtProject = this.dbtProjectContainer.findDBTProject(fullPath);
      if (dbtProject === undefined) {
        return;
      }





      let mysql = await this.dbtProjectContainer.previewSQL(fullPath);
      if (mysql !== undefined) {
        var timeLogger = new TimeLogger(this.terminal);
        timeLogger.f_tic(`Start the query`);

        mysql += ' limit 25';

        const data = await this.dbtProjectContainer.executeSQL(dbtProject.projectRoot, mysql);
        if (data.length > 0) {
          timeLogger.f_toc(`Printing results to a new Execute Query window...`);
          this.queryView.createWebviewPanel(mysql, data);
        }
        else {
          timeLogger.f_toc(`No data returned`);
        }
      } else {
        this.terminal.log(`Can't find the compiled SQL`);
      }
    }
  }

  async runSQLAsIs() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {

      const dbtProject = this.dbtProjectContainer.findDBTProject(fullPath);
      if (dbtProject === undefined) {
        return;
      }

      var timeLogger = new TimeLogger(this.terminal);
      timeLogger.f_tic(`Fetching the 'as-is' (i.e. even the unsaved code) SQL from current active window`);

      let mysql = await vscode.workspace.openTextDocument(fullPath).then((document) => {
        const text = document.getText();
        return text;
      });

      if (mysql !== undefined) {
        mysql += ' limit 25';
        const data = await this.dbtProjectContainer.executeSQL(dbtProject.projectRoot, mysql);
        if (data.length > 0) {
          timeLogger.f_toc(`Printing results to a new Execute Query window...`);
          this.queryView.createWebviewPanel(mysql, data);
        }
        else {
          timeLogger.f_toc(`No data returned`);
        }
      }
    }
  }

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private onManifestCacheChanged(event: ManifestCacheChangedEvent): void {
    event.added?.forEach((added) => {
      this.modelToFQNMap.set(added.projectRoot.fsPath, added.nodeMetaMap);
    });
    event.removed?.forEach((removed) => {
      this.modelToFQNMap.delete(removed.projectRoot.fsPath);
    });
  }
}
