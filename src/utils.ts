import * as vscode from "vscode";

export function getTestRunnerPath() {
    return vscode.workspace.getConfiguration("launchable").get<string>("testRunnerPath");
}

export function getTestCasePath() {
    return vscode.workspace.getConfiguration("launchable").get<string>("testCasePath");
}

export function getTestListCommand() {
    return vscode.workspace.getConfiguration("launchable").get<string>("testListCommand");
}

export function getSubsetPath(tempDir: string) {
    return tempDir + "/" + "subset-" + Date.now().toString() + ".txt";
}

export function getTestReportPath(tempDir: string) {
    return tempDir + "/" + "report-" + Date.now().toString() + ".txt";
}

export async function getPythonPath(): Promise<string | undefined> {
    try {
        // https://github.com/microsoft/vscode-python/issues/11294
        const extension = vscode.extensions.getExtension("ms-python.python");
        const flagValue = extension?.packageJSON?.featureFlags?.usingNewInterpreterStorage;
        if (flagValue) {
            if (!extension.isActive) {
                await extension.activate();
            }
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                return extension.exports.settings.getExecutionDetails(workspaceFolders[0].uri).execCommand[0];
            }
        }
    } catch (error) {}
}

export type LaunchableTreeItemOptions = Pick<
    vscode.TreeItem,
    "id" | "iconPath" | "collapsibleState" | "description" | "tooltip" | "resourceUri"
> & {
    command?: { title: string; command: string; arguments?: any[] };
};

export class LaunchableTreeItem extends vscode.TreeItem {
    public children?: vscode.TreeItem[];
    constructor(label: string, opts: LaunchableTreeItemOptions) {
        super(label);
        this.iconPath = opts.iconPath;
        this.command = opts.command;
    }
}
