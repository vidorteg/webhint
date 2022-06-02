import { createConnection, InitializeResult, ProposedFeatures, TextDocuments, TextDocumentSyncKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { Analyzer } from './utils/analyze';
import { QuickFixActionProvider } from './quickFixProvider';
import { getWehbhintConfigPath, ignoreHintGlobally, ignoreHintPerProject, ignoreProblemInHints } from './webhintUtils';

const [,, globalStoragePath, sourceName] = process.argv;
const connection = createConnection(ProposedFeatures.all);
const analyzer = new Analyzer(globalStoragePath, connection, sourceName);
const documents = new TextDocuments(TextDocument);
const quickFixActionProvider = new QuickFixActionProvider(documents, sourceName);

let workspace = '';

connection.onInitialize((params) => {
    /*
     * TODO: Cache multiple webhint instances based on analyzed document paths,
     * which should allow ignoring workspaces entirely.
     */
    workspace = params.rootPath || '';

    const resultObject: InitializeResult = {capabilities: {textDocumentSync: TextDocumentSyncKind.Full}};

    resultObject.capabilities.codeActionProvider = true;
    resultObject.capabilities.executeCommandProvider = {
        commands: [
            'vscode-webhint/ignore-hint-project',
            'vscode-webhint/ignore-hint-global',
            'vscode-webhint/ignore-problem-project',
            'vscode-webhint/ignore-problem-global',
            'vscode-webhint/edit-hintrc-project',
            'vscode-webhint/edit-hintrc-global'
        ]
    };

    return resultObject;
});

async function updateConfiguration() {
    analyzer.onConfigurationChanged();
    await Promise.all(documents.all().map((doc) => {
        return analyzer.validateTextDocument(doc, workspace);
    }));
}

// A watched .hintrc has changed. Reload the engine and re-validate documents.
connection.onDidChangeWatchedFiles(() => {
    return updateConfiguration();
});

connection.onCodeAction(quickFixActionProvider.provideCodeActions.bind(quickFixActionProvider));

connection.onExecuteCommand(async (params) => {
    const args = params.arguments ?? [];
    const problemName = args[0] as string;
    const hintName = args[1] as string;

    switch (params.command) {
        case 'vscode-webhint/ignore-hint-project': {
            await ignoreHintPerProject(hintName, workspace);
            break;
        }
        case 'vscode-webhint/ignore-hint-global': {
            await ignoreHintGlobally(hintName, globalStoragePath);
            await updateConfiguration();
            break;
        }
        case 'vscode-webhint/ignore-problem-project': {
            const configFilePath = getWehbhintConfigPath(workspace);
            void ignoreProblemInHints(problemName, hintName, configFilePath);
            break;
        }
        case 'vscode-webhint/ignore-problem-global': {
            const configFilePath = getWehbhintConfigPath(globalStoragePath);
            await ignoreProblemInHints(problemName, hintName, configFilePath);
            await updateConfiguration();
            break;
        }
        case 'vscode-webhint/edit-hintrc-project': {
            const configFilePath = getWehbhintConfigPath(workspace);
            connection.window.showDocument({ uri: configFilePath.toString() });
            break;
        }
        case 'vscode-webhint/edit-hintrc-global': {
            const configFilePath = getWehbhintConfigPath(globalStoragePath);
            connection.window.showDocument({ uri: configFilePath.toString() });
            break;
        }
    }
});

// Re-validate the document whenever the content changes.
documents.onDidChangeContent(async (change) => {
    if (!change.document.uri.startsWith('file://')) {
        return; // Only analyze local files (e.g. not internal vscode:// files)
    }
    await analyzer.validateTextDocument(change.document, workspace);
});

// Listen on the text document manager and connection.
documents.listen(connection);
connection.listen();
