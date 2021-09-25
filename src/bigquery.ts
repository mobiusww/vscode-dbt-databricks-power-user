import {
  window
} from "vscode";

export function runAsQuery(queryText: string): void {
  if (!queryText) {
    window.showErrorMessage("Query text is empty");
    return;
  }
  console.log("Invoking run query");
}