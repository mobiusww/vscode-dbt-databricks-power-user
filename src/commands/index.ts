import { commands, Disposable } from "vscode";
import { RunModel } from "./runModel";
import { provideSingleton } from "../utils";
import { InstallDBT } from "./installDBT";
import { UpdateDBT } from "./updateDBT";
import { RunModelType } from "../domain";
import { ExecuteSQL } from "./executeSQL";

@provideSingleton(VSCodeCommands)
export class VSCodeCommands implements Disposable {
  private disposables: Disposable[] = [];

  constructor(
    private installDBT: InstallDBT,
    private updateDBT: UpdateDBT,
    private runModel: RunModel,
    private executeSQL: ExecuteSQL,
  ) {
    this.disposables.push(
      commands.registerCommand("dbtPowerUser.runCurrentModel", () =>
        this.runModel.runModelOnActiveWindow()
      ),    
      commands.registerCommand("dbtPowerUser.runDbtGenDocs", () =>
        this.runModel.runDbtGenDocs()
      ),  
      commands.registerCommand("dbtPowerUser.runDbtServeDocs", () =>
        this.runModel.runDbtServeDocs()
      ),           
      commands.registerCommand("dbtPowerUser.compileCurrentModel", () =>
        this.runModel.compileModelOnActiveWindow()
      ),
      commands.registerCommand("dbtPowerUser.runChildrenModels", (model) =>
        this.runModel.runModelOnNodeTreeItem(RunModelType.CHILDREN)(model)
      ),
      commands.registerCommand("dbtPowerUser.runParentModels", (model) =>
        this.runModel.runModelOnNodeTreeItem(RunModelType.PARENTS)(model)
      ),
      commands.registerCommand("dbtPowerUser.showRunSQL", () =>
        this.runModel.showRunSQLOnActiveWindow()
      ),
      commands.registerCommand("dbtPowerUser.previewSQL", () =>
        this.runModel.previewSQLOnActiveWindow()
      ),
      commands.registerCommand("dbtPowerUser.showCompiledSQL", () =>
        this.runModel.showCompiledSQLOnActiveWindow()
      ),
      commands.registerCommand("dbtPowerUser.installDBT", () =>
        this.installDBT.installDBTCommand()
      ),
      commands.registerCommand("dbtPowerUser.updateDBT", () =>
        this.updateDBT.updateDBTCommand()
      ),
      commands.registerCommand("dbtPowerUser.getCurrentTableFromCloud", () =>
        this.executeSQL.executeSQL()
      ),
      commands.registerCommand("dbtPowerUser.previewCurrentModel", () =>
        this.executeSQL.previewCurrentModel()
      ),  
      commands.registerCommand("dbtPowerUser.runSQLAsIs", () =>
        this.executeSQL.runSQLAsIs()
      ),       
      
      
    );
  }

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}
