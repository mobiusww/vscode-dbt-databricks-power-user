import * as vscode from 'vscode';
import { provideSingleton } from '../utils';

@provideSingleton(QueryView)
export class QueryView {

  createWebviewPanel(sql: string, data: any) {
    const panel = vscode.window.createWebviewPanel(
      'dbtPowerUser.queryView',
      'Table',
      vscode.ViewColumn.One,
      {
        // Enable scripts in the webview
        enableScripts: true,
      }
    );

    const updateWebview = () => {
      panel.webview.html = this.getWebviewContent(sql, data);
    };

    // Set initial content
    updateWebview();
  }

  private getWebviewContent(sql: string, agate: any[]) {
    const columns = Object.keys(agate[0]).map(k => ({title: k}));
    const data = agate.map(row => Object.values(row));
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <style>
        .dataTables_info {
        color: grey !important;
        }
        .dataTables_length {
        color: grey !important;
        }
        .dataTables_filter {
        color: grey !important;
        }
        input, select, textarea{
          color: grey;
        }
        textarea:focus, input:focus {
          color: grey;
        }
      </style>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self';
            script-src vscode-resource: 'self' 'unsafe-inline' 'unsafe-eval' https:;
            style-src vscode-resource: 'self' 'unsafe-inline' https:;
            img-src vscode-resource: 'self' 'unsafe-inline' https:;"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Query view</title>
      
      <script src="https://code.jquery.com/jquery-3.5.1.js"></script>
      <link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/v/dt/dt-1.12.1/datatables.min.css"/>
      <script type="text/javascript" src="https://cdn.datatables.net/v/dt/dt-1.12.1/datatables.min.js"></script>   
      <script>
      $(document).ready(function() {
        var data = ${JSON.stringify(data)};
        $('#data').DataTable( {
          data,
          columns: ${JSON.stringify(columns)},
          "bSort": false,
          "pageLength": 25
        });
      });
      </script>
  </head>
  <body>
  <textarea>${sql}</textarea>
  </textarea>
  <table id="data" class="display" width="100%"></table>
  </body>
  </html>`;
  }
  
}


