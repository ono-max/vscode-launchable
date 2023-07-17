import { getSubsetPath, getTestListCommand, getTestReportPath, getTestRunnerPath } from "./utils";

export class Pytest implements TestRunner {
    name: string;
    testReportPath: string;
    subsetPath: string;
    runningTestCmd: string;
    testListCommand?: string;

    constructor(tempDir: string, pythonPath: string) {
        this.name = "pytest";
        const testRunnerPath = getTestRunnerPath() || `${pythonPath} -m pytest`;
        this.subsetPath = getSubsetPath(tempDir);
        this.testReportPath = getTestReportPath(tempDir);
        this.runningTestCmd = `${testRunnerPath} --junit-xml=${this.testReportPath} $(cat ${this.subsetPath})`;
        this.testListCommand = getTestListCommand() || `${testRunnerPath} --collect-only -q`;
    }
}
