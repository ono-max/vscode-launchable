// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import * as fs from "fs";
import { Maven } from "./maven";
import { Rspec } from "./rspec";
import { TestSubsetRunner } from "./testSubsetRunner";
import { LaunchableTreeItem, inputTestRunner } from "./utils";

export function activate(context: vscode.ExtensionContext) {
    // TODO: Remove this parts before releasing
    context.workspaceState.update(testRunnerKey, undefined);
    context.secrets.delete(launchableTokenKey);

    const provider = new LaunchableTreeDataProvider(context.secrets, context.workspaceState);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("launchableTreeView", provider),

        vscode.commands.registerCommand("launchable.openLink", (uri: vscode.Uri) => {
            vscode.env.openExternal(uri);
        }),

        vscode.commands.registerCommand("launchable.startTest", () => {
            provider.startTest();
        }),

        vscode.commands.registerCommand("launchable.initSettings", () => {
            provider.initSettings();
        }),
    );
}

const launchableTokenKey = "LaunchableToken";
const testRunnerKey = "testRunner";

const outputChannel = vscode.window.createOutputChannel("launchable");

class LaunchableTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private treeItems: vscode.TreeItem[] = [];
    private tempDir: string | undefined;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    constructor(private readonly secretStorage: vscode.SecretStorage, private readonly workspaceState: vscode.Memento) {
        this.treeItems = [
            new LaunchableTreeItem("Start Test", {
                iconPath: new vscode.ThemeIcon("play-circle"),
                command: {
                    title: "launchable.startTest",
                    command: "launchable.startTest",
                },
            }),
        ];
    }

    async getChildren(element?: LaunchableTreeItem): Promise<vscode.TreeItem[] | undefined> {
        if (element) {
            return element.children;
        }
        return this.treeItems;
    }

    cleanup() {
        this.treeItems[0].label = "Start Test";
        this.treeItems[0].iconPath = new vscode.ThemeIcon("play-circle");
        this.treeItems[0].command = {
            title: "launchable.startTest",
            command: "launchable.startTest",
        };
        this._onDidChangeTreeData.fire();
        if (this.tempDir) {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
    }

    async startTest() {
        outputChannel.clear();
        this.treeItems[0].iconPath = new vscode.ThemeIcon("sync~spin");
        this.treeItems[0].label = "Runing";
        this.treeItems[0].command = undefined;
        this._onDidChangeTreeData.fire();
        try {
            const testItems = await TestSubsetRunner.run(this.secretStorage, this.workspaceState, outputChannel);
            if (testItems) {
                this.treeItems = this.treeItems.concat(testItems);
            }
        } finally {
            this.cleanup();
        }
    }

    getTestRunner(testRunnerName: string, tempDir: string): TestRunner | undefined {
        switch (testRunnerName) {
            case "maven":
                return new Maven(tempDir);
            case "rspec":
                return new Rspec(tempDir);
        }
        return void 0;
    }

    async initSettings() {
        const token = await this.inputLaunchableToken();
        if (!token) {
            return;
        }
        this.secretStorage.store(launchableTokenKey, token);
        const runner = await inputTestRunner();
        if (!runner) {
            return;
        }
        this.workspaceState.update(testRunnerKey, runner);
    }

    async inputLaunchableToken() {
        return vscode.window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            placeHolder: "Workspace API key",
            validateInput: async (token) => {
                if (token.length === 0) {
                    return "API key can not be empty";
                }
                return null;
            },
        });
    }

    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;
}

// this method is called when your extension is deactivated
export function deactivate() {}
