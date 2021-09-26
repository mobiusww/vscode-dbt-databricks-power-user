import "reflect-metadata";
import { ExtensionContext } from "vscode";
import { DBTPowerUserExtension } from "./dbtPowerUserExtension";
import { container } from "./inversify.config";
import { activate as bigquery_activate} from "./bigquery";

export async function activate(context: ExtensionContext) {
  const dbtPowerUserExtension = container.get(DBTPowerUserExtension);
  
  context.subscriptions.push(
    dbtPowerUserExtension,
  );

  await dbtPowerUserExtension.activate();
  await bigquery_activate(context);
}

export function deactivate() {}
