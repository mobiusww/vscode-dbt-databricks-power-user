import "reflect-metadata";
import { ExtensionContext } from "vscode";
import { DBTPowerUserExtension } from "./dbtPowerUserExtension";
import { container } from "./inversify.config";
import { activate as bigquery_activate} from "./bigquery";
import { activate as queryrunner_activate} from "./queryrunner_install";
export async function activate(context: ExtensionContext) {
  const dbtPowerUserExtension = container.get(DBTPowerUserExtension);
  
  context.subscriptions.push(
    dbtPowerUserExtension,
  );

  await dbtPowerUserExtension.activate(context);
  await bigquery_activate(context, dbtPowerUserExtension);
  await queryrunner_activate(context, dbtPowerUserExtension);
}

export function deactivate() {}
