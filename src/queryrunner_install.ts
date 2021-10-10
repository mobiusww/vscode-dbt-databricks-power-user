// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
	workspace,
	RelativePattern
} from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BigQueryRunner } from './queryrunner';

const configPrefix = "bigquery";
let config: vscode.WorkspaceConfiguration;
// let output = vscode.window.createOutputChannel("QueryRunner");
let  vscontext: vscode.ExtensionContext;
let  bigQueryRunner: BigQueryRunner;
let  panel: vscode.WebviewPanel; 

export async function compileAndRunQuery(targetPath: string, projectRoot: vscode.Uri) {
	console.log('calling runQueryRunnerWithText');
	if (bigQueryRunner) {
		if (targetPath){
			bigQueryRunner.setTargetPath(targetPath);
		}
		if (projectRoot) {
			bigQueryRunner.setProjectRoot(projectRoot);
		}
	}
	if (vscontext) {
		await openQueryRunner(true);
	}
	
}


async function openQueryRunner(compile?: boolean) {
	let context = vscontext;
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	bigQueryRunner.setEditor(editor);
	let localResourceRoot = vscode.Uri.file(path.join(context.extensionPath,'public'));
	console.log('localResourceRoot: ' + localResourceRoot);
	// check if panel exists and reuse it.
	if (!panel) {
		panel = vscode.window.createWebviewPanel(
			'queryRunner', // Identifies the type of the webview. Used internally
			'QueryRunner', // Title of the panel displayed to the user
			vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [localResourceRoot]
			}
		);
	}
	else if (!panel.visible) {
		panel.reveal(vscode.ViewColumn.Beside);
	}

	panel.webview.html = getWebviewContent(context);

	// Send variables to webview.
	// const variables = context.workspaceState.get("variables", {});
	// panel.webview.postMessage({ command: 'setVariables', variables: variables });

	panel.webview.onDidReceiveMessage(
		async message => {
			switch (message.command) {
				// case 'openExternal':
				// 		vscode.env.openExternal(message.url);
				// 	break;

				case 'runAsQuery':
					const queryResult = await bigQueryRunner.runAsQuery(compile);
					if (queryResult.status === "error") {
						panel.webview.postMessage({ command: 'queryError', errorMessage: queryResult.errorMessage });
					} else {
						panel.webview.postMessage({ command: 'runAsQuery', result: queryResult });
					}
					break;

				case 'cancelQuery':
					const cancelResult = await bigQueryRunner.cancelQuery();
					panel.webview.postMessage({ command: 'cancelQuery', result: cancelResult });
					break;

				case 'saveVariables':
					context.workspaceState.update("variables", message.variables);
					break;
			}
		},
		undefined,
		context.subscriptions
	);
	
	// start running query upon opening the window
	console.log(`executing openQueryRunner runAsQuery on open`);
	const queryResult = await bigQueryRunner.runAsQuery();
	if (queryResult.status === "error") {
		panel.webview.postMessage({ command: 'queryError', errorMessage: queryResult.errorMessage });
	} else {
		panel.webview.postMessage({ command: 'runAsQuery', result: queryResult });
	}

}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	readConfig();

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	bigQueryRunner = new BigQueryRunner(config, editor);
    vscontext = context;
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (!event.affectsConfiguration(configPrefix)) {
				return;
			}

			readConfig();
			bigQueryRunner.setConfig(config);
		})
	);
	// openQueryRunner is when the active text editor is compiled sql
	let disposable = vscode.commands.registerCommand("dbtPowerUser.openQueryRunner", async() => {await openQueryRunner(false);});
	context.subscriptions.push(disposable);

}

function readConfig(): void {
	try {
		config = vscode.workspace.getConfiguration(configPrefix);
	} catch (e) {
		vscode.window.showErrorMessage(`failed to read config: ${e}`);
	}
}

function getWebviewContent(context: vscode.ExtensionContext): string {
	let indexPath = vscode.Uri.file(
		path.join(context.extensionPath, 'public', 'index.html')
	);
	indexPath = indexPath.with({ scheme: 'vscode-resource' });

	let html = fs.readFileSync(indexPath.path).toString();

	let resourceDir = vscode.Uri.file(
		path.join(context.extensionPath, 'public')
	);
	resourceDir = resourceDir.with({ scheme: 'vscode-resource' });

	return html.replace(new RegExp('__RESOURCE_DIR__', 'g'), resourceDir.toString());
}

// function publicPath(filePath: string, context: vscode.ExtensionContext): string {
// }

// this method is called when your extension is deactivated
export function deactivate() { }
