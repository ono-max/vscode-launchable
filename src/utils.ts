import * as vscode from "vscode";

export function getTestRunnerPath() {
    return vscode.workspace.getConfiguration("launchable").get<string>("testRunnerPath");
}

export function getTestCasePath() {
    return vscode.workspace.getConfiguration("launchable").get<string>("testCasePath");
}

export function getSubsetPath(tempDir: string) {
    return tempDir + "/" + "subset-" + Date.now().toString() + ".txt";
}

export function getTestReportPath(tempDir: string) {
    return tempDir + "/" + "report-" + Date.now().toString() + ".txt";
}
