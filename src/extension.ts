// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import * as cp from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";
import * as fs from "fs";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand("vscode-launchable.helloWorld", () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage("Hello World from vscode-launchable!");
    });

    const provider = new LaunchableTreeDataProvider(context.secrets);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("launchableTreeView", provider),

        vscode.commands.registerCommand("hoge", (uri: vscode.Uri) => {
            vscode.env.openExternal(uri);
        }),

        vscode.commands.registerCommand("startTest", () => {
            provider.startTest();
        }),
    );

    context.subscriptions.push(disposable);
}

const asyncExec = promisify(cp.exec);
const launchableTokenKey = "LaunchableToken";

class LaunchableTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private treeItems: vscode.TreeItem[] = [];
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    constructor(private readonly secretStorage: vscode.SecretStorage) {
        this.treeItems = [
            new LaunchableTreeItem("Start Test", {
                iconPath: new vscode.ThemeIcon("play-circle"),
                command: {
                    title: "foo",
                    command: "startTest",
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

    cleanup(tempDir?: string) {
        this.treeItems[0].label = "Start Test";
        this.treeItems[0].iconPath = new vscode.ThemeIcon("play-circle");
        this.treeItems[0].command = {
            title: "foo",
            command: "startTest",
        };
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    async startTest() {
        let launchableToken = await this.secretStorage.get(launchableTokenKey);
        if (!launchableToken) {
            launchableToken = await vscode.window.showInputBox({
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
        this.treeItems[0].iconPath = new vscode.ThemeIcon("sync~spin");
        this.treeItems[0].label = "Runing";
        this.treeItems[0].command = undefined;
        this._onDidChangeTreeData.fire();
        const pythonPath = (await getPythonPath()) || "python";
        const folders = vscode.workspace.workspaceFolders;
        if (folders === undefined) {
            return;
        }
        const opts: cp.ExecOptions = {
            env: {
                ...process.env,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                LAUNCHABLE_TOKEN: launchableToken,
            },
            cwd: folders[0].uri.fsPath,
        };

        try {
            await asyncExec(`${pythonPath} -m launchable verify`, opts);
        } catch (error) {
            await this.secretStorage.delete(launchableTokenKey);
            return;
        }

        const uuid = crypto.randomUUID();
        try {
            await asyncExec(`${pythonPath} -m launchable record build --name ${uuid}`, opts);
        } catch (error) {
            console.error(error);
            return;
        }

        try {
            const result = await asyncExec(`${pythonPath} -m launchable subset --target 80% maven src/test/java`, opts);
            const subset = new LaunchableTreeItem("Subset of Tests", {});
            subset.children = [];
            subset.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            for (const r of result.stdout.trim().split("\n")) {
                subset.children.push(new LaunchableTreeItem(r, {}));
            }
            this.treeItems.push(subset);
            try {
                fs.writeFileSync("/Users/s15236/workspace/launchable-java-example/test.txt", result.stdout);
            } catch (error) {
                console.error(error);
            }
        } catch (error) {
            console.error(error);
            return;
        }

        try {
            await asyncExec(
                `/opt/homebrew/bin/mvn test -Dsurefire.includesFile=/Users/s15236/workspace/launchable-java-example/test.txt`,
                opts,
            );
        } catch (error) {
            console.error(error);
            return;
        }

        try {
            const { stdout } = await asyncExec(
                `${pythonPath} -m launchable record tests maven target/surefire-reports/TEST-example.*.xml`,
                opts,
            );
            const found = stdout.match(/(https:\/\/app.launchableinc.com\/organizations.*\/(.*))\sto/);
            if (found) {
                const result = new LaunchableTreeItem("Result", {});
                result.children = [
                    new LaunchableTreeItem(`Test Session: #${found[2].toString()}`, {
                        command: {
                            title: "foo",
                            command: "hoge",
                            arguments: [vscode.Uri.parse(found[1].toString())],
                        },
                    }),
                ];
                result.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                this.treeItems.push(result);
            }
        } catch (error) {
            console.error(error);
            return;
        }
        this.treeItems[0].label = "Start Test";
        this.treeItems[0].iconPath = new vscode.ThemeIcon("play-circle");
        this.treeItems[0].command = {
            title: "foo",
            command: "startTest",
        };
        this._onDidChangeTreeData.fire();
    }

    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;
}

async function getPythonPath(): Promise<string | undefined> {
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

type LaunchableTreeItemOptions = Pick<
    vscode.TreeItem,
    "id" | "iconPath" | "collapsibleState" | "description" | "tooltip" | "resourceUri"
> & {
    command?: { title: string; command: string; arguments?: any[] };
};

class LaunchableTreeItem extends vscode.TreeItem {
    public children?: vscode.TreeItem[];
    constructor(label: string, opts: LaunchableTreeItemOptions) {
        super(label);
        this.iconPath = opts.iconPath;
        this.command = opts.command;
    }
}

// this method is called when your extension is deactivated
export function deactivate() {}
