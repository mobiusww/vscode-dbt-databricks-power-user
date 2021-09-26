# vscode-dbt-bigquery-power-user



This extension makes vscode seamlessly work with [dbt](https://www.getdbt.com/) and Biq Query
This extension is based on the [vscode-dbt-power-user](https://github.com/innoverio/vscode-dbt-power-user) extension made by Innoverio and adds
a *preview sql* command that compiles (if not updated) the model and runs the compiled sql
on BigQuery. 
The Big Query integration uses code based on the [vscode-big-query](https://github.com/google/vscode-bigquery) extension but has been extensively modified. 

The vscode-dbt-bigquery-power-user extension is a drop-in replacement for vscode-dbt-power-user and
is incompatible with concurrent usage (as they use the same config and registered commands). 

On the other hand, you can still install the [vscode-bigquery](https://github.com/google/vscode-bigquery) extension (and use the same config) which will allow you to run BigQuery sql queries on compiled dbt sql files.



