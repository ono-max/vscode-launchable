import * as vscode from "vscode";

import * as fs from "fs";
import * as asyncfs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Maven } from "./maven";
import { Rspec } from "./rspec";
import { TestSubsetRunner } from "./testSubsetRunner";
import { LaunchableTreeItem, inputTestRunner } from "./utils";

const launchableCandidateRepositoriesKey = "LaunchableCandidateRepositories";
const launchableTargetFileKey = "LaunchableTargetFile";

export function activate(context: vscode.ExtensionContext) {
    const provider = new LaunchableTreeDataProvider(context.secrets, context.workspaceState);
    context.globalState.setKeysForSync([launchableCandidateRepositoriesKey]);
    asyncInsertCandidateRepositories(context.globalState);

    const launchableTargetFile = context.globalState.get<string>(launchableTargetFileKey);
    if (launchableTargetFile !== undefined) {
        const opts: vscode.TextDocumentShowOptions = {
            preserveFocus: true,
        };
        vscode.commands.executeCommand("vscode.open", vscode.Uri.file(launchableTargetFile), opts);
        context.globalState.update(launchableTargetFileKey, undefined);
    }

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

        vscode.window.registerUriHandler({
            async handleUri(uri: vscode.Uri) {
                let candidateRepositoriesMap = context.globalState.get<CandidateRepositories>(
                    launchableCandidateRepositoriesKey,
                );
                if (candidateRepositoriesMap === undefined) {
                    candidateRepositoriesMap = {};
                    await findCandidateRepositories(candidateRepositoriesMap, os.homedir(), 5);
                    await context.globalState.update(launchableCandidateRepositoriesKey, candidateRepositoriesMap);
                }
                const params = new URLSearchParams(uri.query);
                const candidateRepos = candidateRepositoriesMap[params.get("workspace") || ""];
                if (candidateRepos === undefined) {
                    return;
                }
                // file example: src/test/foo_test.py
                const file = params.get("file");
                let targetFilePath: string = "";
                let repositoryPath: string = "";
                if (file !== null) {
                    const repo = await findRepositoryPath(candidateRepos, file);
                    if (repo === undefined) {
                        return;
                    }
                    repositoryPath = repo;
                    targetFilePath = path.join(repositoryPath, file);
                } else {
                    // package example: src/test/java/com/sample
                    const pkg = params.get("package");
                    // class example: com.sample.service.FooBar
                    const klass = params.get("class");
                    if (pkg !== null && klass !== null) {
                        const baseName = klass.split(".").pop();
                        if (baseName === undefined) {
                            return;
                        }
                        const fileName = await resolveExtensionName(candidateRepos, pkg, baseName);
                        if (fileName === undefined) {
                            return;
                        }
                        const repo = await findRepositoryPath(candidateRepos, path.join(pkg, fileName));
                        if (repo === undefined) {
                            return;
                        }
                        repositoryPath = repo;
                        targetFilePath = path.join(repositoryPath, path.join(pkg, fileName));
                    }
                }
                const folders = vscode.workspace.workspaceFolders;
                if (folders && folders[0].uri.path === repositoryPath) {
                    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(targetFilePath));
                    await context.globalState.update(launchableTargetFileKey, undefined);
                } else {
                    await context.globalState.update(launchableTargetFileKey, targetFilePath);
                    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(repositoryPath), {
                        forceNewWindow: true,
                    });
                }
            },
        }),
    );
}

async function findRepositoryPath(candidateRepoPaths: string[], targetFileRelativePath: string) {
    for (const candidate of candidateRepoPaths) {
        try {
            await asyncfs.access(path.join(candidate, targetFileRelativePath), fs.constants.R_OK);
        } catch (error) {
            continue;
        }
        return candidate;
    }
}

async function resolveExtensionName(candidateRepoPaths: string[], targetFileRelativePath: string, baseName: string) {
    for (const candidate of candidateRepoPaths) {
        try {
            const files = await asyncfs.readdir(path.join(candidate, targetFileRelativePath), { withFileTypes: true });
            for (const file of files) {
                if (file.isFile() && file.name.startsWith(baseName)) {
                    return file.name;
                }
            }
        } catch (error) {
            continue;
        }
    }
}

interface CandidateRepositories {
    [key: string]: string[];
}

async function asyncInsertCandidateRepositories(memento: vscode.Memento) {
    const gitDirs: CandidateRepositories = {};
    await findCandidateRepositories(gitDirs, os.homedir(), 10);
    await memento.update(launchableCandidateRepositoriesKey, gitDirs);
    outputChannel.appendLine("Candidate Repository Map is created");
}

async function findCandidateRepositories(gitDirs: CandidateRepositories, targetDir: string, maxDepth: number) {
    if (maxDepth === 0) {
        return;
    }
    let dirs: fs.Dirent[];
    try {
        dirs = await asyncfs.readdir(targetDir, { withFileTypes: true });
    } catch (error) {
        return;
    }
    for (const dir of dirs) {
        if (dir.isDirectory()) {
            if (dir.name === ".git") {
                const fullPaths = gitDirs[path.basename(targetDir)];
                if (fullPaths === undefined) {
                    gitDirs[path.basename(targetDir)] = [targetDir];
                } else {
                    gitDirs[path.basename(targetDir)] = [...fullPaths, targetDir];
                }
            } else {
                await findCandidateRepositories(gitDirs, path.join(targetDir, dir.name), maxDepth - 1);
            }
        }
    }
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

export function deactivate() {}
