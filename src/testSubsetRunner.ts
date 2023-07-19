import * as vscode from "vscode";

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as cp from "child_process";
import * as crypto from "crypto";
import { Maven } from "./maven";
import { Rspec } from "./rspec";
import { findRuntimes } from "jdk-utils";
import {
    LaunchableTreeItem,
    getConfidenceTarget,
    getFixedTimeTarget,
    getPercentageTimeTarget,
    getPythonPath,
    inputTestRunner,
} from "./utils";
import { promisify } from "util";
import { GoTest } from "./goTest";
import { Pytest } from "./pytest";

const launchableTokenKey = "LaunchableToken";
const testRunnerKey = "testRunner";
const asyncExec = promisify(cp.exec);

export class TestSubsetRunner {
    static async run(
        secretStorage: vscode.SecretStorage,
        workspaceState: vscode.Memento,
        outputChannel: vscode.OutputChannel,
    ) {
        let launchableToken = await secretStorage.get(launchableTokenKey);
        if (!launchableToken) {
            const token = await this.inputLaunchableToken();
            if (!token) {
                return;
            }
            secretStorage.store(launchableTokenKey, token);
            launchableToken = token;
        }
        let testRunnerName = workspaceState.get<string>(testRunnerKey);
        if (!testRunnerName) {
            const name = await inputTestRunner();
            if (!name) {
                return;
            }
            workspaceState.update(testRunnerKey, name);
            testRunnerName = name;
        }
        let tempDir: string;
        try {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-launchable-"));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create a temporary directory: ${error}`);
            return;
        }
        const pythonPath = (await getPythonPath()) || "python";
        const testRunner = this.getTestRunner(testRunnerName, tempDir, pythonPath);
        if (!testRunner) {
            vscode.window.showErrorMessage(`Failed to get a test runner. Test Runner Name: ${testRunnerName}`);
            return;
        }
        const folders = vscode.workspace.workspaceFolders;
        if (folders === undefined) {
            return;
        }
        // TODO: sort runtimes and choose the latest one
        const runtimes = await findRuntimes();
        const opts: cp.ExecOptions = {
            env: {
                ...process.env,
                /* eslint-disable @typescript-eslint/naming-convention */
                LAUNCHABLE_TOKEN: launchableToken,
                JAVA_HOME: runtimes[0].homedir,
                /* eslint-enable @typescript-eslint/naming-convention */
            },
            cwd: folders[0].uri.fsPath,
        };
        const runner = new TestSubsetRunner(
            secretStorage,
            workspaceState,
            opts,
            pythonPath,
            testRunner,
            tempDir,
            outputChannel,
        );
        await runner.run();
        return runner.treeItems;
    }

    static getTestRunner(testRunnerName: string, tempDir: string, pythonPath: string): TestRunner | undefined {
        switch (testRunnerName) {
            case "maven":
                return new Maven(tempDir);
            case "rspec":
                return new Rspec(tempDir);
            case "go-test":
                return new GoTest(tempDir);
            case "pytest":
                return new Pytest(tempDir, pythonPath);
        }
        return void 0;
    }

    static async inputLaunchableToken() {
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

    private constructor(
        private readonly secretStorage: vscode.SecretStorage,
        private readonly workspaceState: vscode.Memento,
        private readonly execOpts: cp.ExecOptions,
        private readonly pythonPath: string,
        private readonly testRunner: TestRunner,
        private readonly tempDir: string,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly treeItems: vscode.TreeItem[] = [],
    ) {}

    private async run() {
        this.outputChannel.clear();
        try {
            await this.runTest();
        } finally {
            try {
                const { stdout } = await this.execLaunchableCommand(
                    `${this.pythonPath} -m launchable record tests ${this.testRunner.name} ${this.testRunner.testReportPath}`,
                    this.execOpts,
                );
                const found = stdout.match(/(https:\/\/app.launchableinc.com\/organizations.*\/(.*))\sto/);
                if (found) {
                    const result = new LaunchableTreeItem("Result", {});
                    result.children = [
                        new LaunchableTreeItem(`Test Session: #${found[2].toString()}`, {
                            command: {
                                title: "launchable.openLink",
                                command: "launchable.openLink",
                                arguments: [vscode.Uri.parse(found[1].toString())],
                            },
                        }),
                    ];
                    result.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                    this.treeItems.push(result);
                }
            } catch (error) {
                this.clearTreeItems();
            }
            this.cleanup();
        }
    }

    private async runTest() {
        try {
            await this.execLaunchableCommand(`${this.pythonPath} -m launchable verify`, this.execOpts);
        } catch (error) {
            this.secretStorage.delete(launchableTokenKey);
            this.workspaceState.update(testRunnerKey, undefined);
            return;
        }

        const uuid = crypto.randomUUID();
        try {
            await this.execLaunchableCommand(
                `${this.pythonPath} -m launchable record build --name ${uuid}`,
                this.execOpts,
            );
        } catch (error) {
            return;
        }

        let subsetCommand: string = "";
        if (this.testRunner.testListCommand) {
            subsetCommand += `${this.testRunner.testListCommand} | `;
        }
        subsetCommand += `${this.pythonPath} -m launchable subset`;
        const confidence = getConfidenceTarget();
        if (confidence) {
            subsetCommand += ` --confidence ${confidence}`;
        }
        const fixed = getFixedTimeTarget();
        if (fixed) {
            subsetCommand += ` --time ${fixed}`;
        }
        const percentage = getPercentageTimeTarget();
        if (percentage) {
            subsetCommand += ` --target ${percentage}`;
        }
        if (this.testRunner.testCasePath) {
            subsetCommand += ` ${this.testRunner.testCasePath}`;
        }
        subsetCommand += ` ${this.testRunner.name}`;
        let stdout: string;
        try {
            const result = await this.execLaunchableCommand(subsetCommand, this.execOpts);
            stdout = result.stdout;
            const subset = new LaunchableTreeItem("Subset of Tests", {});
            subset.children = [];
            subset.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            for (const r of stdout.trim().split("\n")) {
                subset.children.push(new LaunchableTreeItem(r, {}));
            }
            this.treeItems.push(subset);
        } catch (error) {
            return;
        }

        try {
            fs.writeFileSync(this.testRunner.subsetPath, stdout);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create a temporary file: ${error}`);
            this.clearTreeItems();
            return;
        }

        // When a test is failed, we should not show an error message.
        this.outputChannel.appendLine(`Running: ${this.testRunner.runningTestCmd}`);
        try {
            await asyncExec(this.testRunner.runningTestCmd, this.execOpts);
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(error.message);
            }
            return;
        }
    }

    private clearTreeItems() {
        while (this.treeItems.length > 0) {
            this.treeItems.pop();
        }
    }

    private async execLaunchableCommand(cmd: string, opts: cp.ExecOptions) {
        this.outputChannel.appendLine(`Running: ${cmd}`);
        try {
            const result = await asyncExec(cmd, opts);
            this.outputChannel.appendLine(`stdout: ${result.stdout}`);
            this.outputChannel.appendLine(`stderr: ${result.stderr}`);
            return result;
        } catch (error) {
            if (error instanceof Error) {
                this.outputChannel.appendLine(error.message);
            }
            vscode.window
                .showErrorMessage(`Launchable: Running "${cmd}" is failed`, "Check error logs")
                .then((select) => {
                    if (select) {
                        this.outputChannel.show();
                    }
                });
            throw error;
        }
    }

    private cleanup() {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
}
