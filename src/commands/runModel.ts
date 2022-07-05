import { Uri, window } from "vscode";
import { RunModelType } from "../domain";
import { DBTProjectContainer } from "../manifest/dbtProjectContainer";
import { NodeTreeItem } from "../treeview_provider/ModelTreeviewProvider";
import { provideSingleton } from "../utils";

@provideSingleton(RunModel)
export class RunModel {
  constructor(private dbtProjectContainer: DBTProjectContainer) {}

  runModelOnActiveWindow(type?: RunModelType) {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      this.runDBTModel(fullPath, type);
    }
  }
  

  runDbtGenDocs() {
    const fullPath = window.activeTextEditor?.document.uri;
    // const a = projectu
    if (fullPath !== undefined) {
      this.genDBTDocs();
    }
  }  
  runDbtServeDocs() {
    const fullPath = window.activeTextEditor?.document.uri;
    // const a = projectu
    if (fullPath !== undefined) {
      this.serveDBTDocs();
    }
  }  

  compileModelOnActiveWindow(type?: RunModelType) {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      this.compileDBTModel(fullPath, type);
    }
  }

  runModelOnNodeTreeItem(type: RunModelType) {
    return (model?: NodeTreeItem) => {
      if (model === undefined) {
        this.runModelOnActiveWindow(type);
        return;
      }
      this.runDBTModel(Uri.file(model.url), type);
    };
  }

  showCompiledSQLOnActiveWindow() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      this.showCompiledSQL(fullPath);
    }
  }

  showRunSQLOnActiveWindow() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      this.showRunSQL(fullPath);
    }
  }

  previewSQLOnActiveWindow() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      this.previewSQL(fullPath);
    }
  }  

  runDBTModel(modelPath: Uri, type?: RunModelType) {
    this.dbtProjectContainer.runModel(modelPath, type);
  }

  genDBTDocs() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      const dbtProject = this.dbtProjectContainer.findDBTProject(fullPath);
      if (dbtProject === undefined) {
        return;
      }
      this.dbtProjectContainer.genDocs(dbtProject.projectRoot);
    }
  }
  serveDBTDocs() {
    const fullPath = window.activeTextEditor?.document.uri;
    if (fullPath !== undefined) {
      const dbtProject = this.dbtProjectContainer.findDBTProject(fullPath);
      if (dbtProject === undefined) {
        return;
      }
      this.dbtProjectContainer.serveDocs(dbtProject.projectRoot);
    }
  }
  compileDBTModel(modelPath: Uri, type?: RunModelType) {
    this.dbtProjectContainer.compileModel(modelPath, type);
  }

  showCompiledSQL(modelPath: Uri) {
    this.dbtProjectContainer.showCompiledSQL(modelPath);
  }

  showRunSQL(modelPath: Uri) {
    this.dbtProjectContainer.showRunSQL(modelPath);
  }
  previewSQL(modelPath: Uri) {
    this.dbtProjectContainer.previewSQL(modelPath);
  }  
}
