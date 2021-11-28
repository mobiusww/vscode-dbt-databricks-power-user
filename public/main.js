const vscode = acquireVsCodeApi();

async function call(param) {
    return await vscode.postMessage(param);
}

const vueApp = new Vue({
    el: '#app',
    data: {
        activeTag: 'info',
        queryStatus: 'none',
        sql: null,
        variablesString: '{}',
        info: null,
        table: null,
        json: '',
        detail: 'det',
        errorMessage: null,
        startIndex: 0,
        hasNext: false,
        hasPrev: false,
        maxResults: 0,
        totalRecords: 0,
    },
    computed: {
        elapsedTime() {
            if (!this.info || !this.info.startTime || !this.info.endTime) {
                return;
            }

            return (parseInt(this.info.endTime) - parseInt(this.info.startTime)) / 1000;
        },
        totalBytesProcessed() {
            if (!this.info || !this.info.totalBytesProcessed) {
                return;
            }

            return this.info.totalBytesProcessed; // TODO
        },
        maxResults() {

            return this.maxResults;

        },
        totalRecords() {

            return this.totalRecords;

        },
        startIndex() {

            return this.startIndex;

        }
    },
    watch: {
        variablesString(val) {
            if (this._parseVariables()) {
                call({
                    command: 'saveVariables',
                    variables: this._parseVariables(),
                });
            }
        }
    },
    methods: {
        _parseVariables() {
            try {
                return JSON.parse(this.variablesString);
            } catch {
                return null;
            }
        },

        nextPage() {
            this.queryStatus = 'runningAsQuery';
            call({
                command: 'nextPage',
                variables: this._parseVariables() || {},
            });
        },

        prevPage() {
            this.queryStatus = 'runningAsQuery';
            call({
                command: 'prevPage',
                variables: this._parseVariables() || {},
            });
        },
        firstPage() {
            this.queryStatus = 'runningAsQuery';
            call({
                command: 'firstPage',
                variables: this._parseVariables() || {},
            });
        },

        lastPage() {
            this.queryStatus = 'runningAsQuery';
            call({
                command: 'lastPage',
                variables: this._parseVariables() || {},
            });
        },

        runAsQuery() {
            this.queryStatus = 'runningAsQuery';
            call({
                command: 'runAsQuery',
                variables: this._parseVariables() || {},
            });
        },
        saveAsCSV() {
            this.queryStatus = 'done';
            call({
                command: 'saveAsCSV',
                variables: this._parseVariables() || {},
            });
        },
        saveAsTable() {
            this.queryStatus = 'done';
            call({
                command: 'saveAsTable',
                variables: this._parseVariables() || {},
            });
        },
        saveAsJSON() {
            this.queryStatus = 'done';
            call({
                command: 'saveAsJSON',
                variables: this._parseVariables() || {},
            });
        },

        displayResult(result) {
            this.activeTag = 'table';
            this.queryStatus = 'done';
            this.sql = result.sql;
            this.info = result.info;
            this.table = result.table;
            this.startIndex = result.startIndex;
            // this.json = result.json
            this.detail = result.detail;
            this.hasNext = result.hasNext ? "true" : "false";
            this.hasPrev = result.hasPrev ? "true" : "false";
            this.maxResults = result.maxResults;
            this.totalRecords = result.totalRecords;

        },

        displayValue(value) {
            if (value === null) {
                return 'NULL';
            } else {
                return value;
            }
        },

        cancelQuery() {
            this.queryStatus = 'none';

            call({
                command: 'cancelQuery',
            });
        },

        didCancelQuery() {
            this.queryStatus = 'none';
        },

        displayError(errorMessage) {
            this.queryStatus = 'error';
            this.errorMessage = errorMessage;
        },

        setVariables(variables) {
            this.variablesString = JSON.stringify(variables, null, "  ");
        },


    },
});

window.addEventListener('message', event => {
    switch (event.data.command) {
        case 'runAsQuery':
            vueApp.displayResult(event.data.result);
            break;
        case 'nextPage':
            vueApp.displayResult(event.data.result);
            break;
        case 'prevPage':
            vueApp.displayResult(event.data.result);
            break;
        case 'queryError':
            vueApp.displayError(event.data.errorMessage);
            break;
        case 'cancelQuery':
            vueApp.didCancelQuery();
            break;
        case 'setVariables':
            vueApp.setVariables(event.data.variables);
            break;
    }
});