import {
    getSubsetPathConfig,
    getTestListCommand,
    getTestReportPathConfig,
    getTestRunCommand,
    resolvePath,
} from "./utils";
import * as vscode from "vscode";

export class File implements TestRunner {
    name: string;

    static async create() {
        const subsetPath =
            getSubsetPathConfig() ||
            (await this.inputText(
                "Enter the path to the file that is a subset of tests",
                "e.g. launchable-subset.txt",
            ));
        const runningTestCmd =
            getTestRunCommand() ||
            (await this.inputText("Enter the command to run tests", "e.g. mocha $(< launchable-subset.txt)"));
        const testListCommand =
            getTestListCommand() ||
            (await this.inputText(
                "Enter the command to get the full list of test files",
                "e.g. find ./test -name '*.js'",
            ));
        const testReportPath =
            getTestReportPathConfig() ||
            (await this.inputText("Enter the path to your test report files", "e.g. ./reports/*.xml"));
        return new File(resolvePath(subsetPath), testReportPath, runningTestCmd, testListCommand);
    }

    private constructor(
        public subsetPath: string,
        public testReportPath: string,
        public runningTestCmd: string,
        public testListCommand: string,
    ) {
        this.name = "file";
    }

    private static async inputText(prompt: string, placeHolder?: string) {
        const text = await vscode.window.showInputBox({
            prompt,
            placeHolder,
            validateInput: async (token) => {
                if (token.length === 0) {
                    return "This field can not be empty";
                }
                return null;
            },
        });
        if (text) {
            return text;
        }
        throw Error("This field must not be empty");
    }
}
