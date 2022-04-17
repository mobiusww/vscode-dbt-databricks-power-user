import path = require('path');
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import { provideSingleton } from '../utils';

@provideSingleton(QueryView)
export class QueryView {

  createWebviewPanel(context:ExtensionContext|undefined, sql: string, data: any) {
    const panel = vscode.window.createWebviewPanel(
      'dbtPowerUser.queryView',
      'Execute query',
      vscode.ViewColumn.One,
      {
        // Enable scripts in the webview
        enableScripts: true,
      }
    );

    const updateWebview = () => {
      panel.webview.html = this.getWebviewContent(context,sql, data);
    };

    // Set initial content
    updateWebview();
  }

  private getWebviewContent(context:ExtensionContext|undefined, sql: string, agate: any[]) {
    const columns = Object.keys(agate[0]).map(k => ({title: k}));
    const data = agate.map(row => Object.values(row));
    let fullPath = "";
    if (context) {
      fullPath = path.join(context.extensionPath, 'public');
    }
 
	  const RESOURCE_DIR = vscode.Uri.file(fullPath).with({ scheme: 'vscode-resource' }).toString();
  
    const THEME = 'dark';
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self';
            script-src vscode-resource: 'self' 'unsafe-inline' 'unsafe-eval' https:;
            style-src vscode-resource: 'self' 'unsafe-inline' https:;
            img-src vscode-resource: 'self' 'unsafe-inline' https:;"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Query view</title>
      <link rel="stylesheet" href="https://cdn.datatables.net/1.11.5/css/jquery.dataTables.min.css"></link>
      <link rel="stylesheet" href="${RESOURCE_DIR}/bulma.min.css" />
      <link rel="stylesheet" href="${RESOURCE_DIR}/style.css" />
      <link rel="stylesheet" href="${RESOURCE_DIR}/style-${THEME}.css" />

      <script src="https://code.jquery.com/jquery-3.5.1.js"></script>
      <script src="https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js"></script>
      <script>
      $(document).ready(function() {
        var data = ${JSON.stringify(data)};
        $('#data').DataTable( {
          data,
          columns: ${JSON.stringify(columns)}
        });
      });
      </script>
  </head>
  <body>
  <div class="table-container">
  <textarea>${sql}</textarea>
  </textarea>
  <table id="data" class="display table is-bordered is-striped is-narrow is-hoverable" width="100%"></table>
  </div>
  </body>
  </html>`;
  }
  
}


