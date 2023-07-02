import * as vscode from "vscode";

export function getTestRunnerPath() {
    return vscode.workspace.getConfiguration("launchable").get<string>("testRunnerPath");
}

export function getTestCasePath() {
    return vscode.workspace.getConfiguration("launchable").get<string>("testCasePath");
}
