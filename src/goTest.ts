import { getSubsetPath, getTestListCommand, getTestReportPath, getTestRunnerPath } from "./utils";

export class GoTest implements TestRunner {
    name: string;
    testReportPath: string;
    subsetPath: string;
    runningTestCmd: string;
    testListCommand?: string;

    constructor(tempDir: string) {
        this.name = "go-test";
        const testRunnerPath = getTestRunnerPath() || "go test";
        this.subsetPath = getSubsetPath(tempDir);
        this.testReportPath = getTestReportPath(tempDir);
        this.runningTestCmd = `${testRunnerPath} -run $(cat ${this.subsetPath}) ./... -v 2>&1 | go-junit-report > ${this.testReportPath}`;
        this.testListCommand = getTestListCommand() || `${testRunnerPath} -list . ./...`;
    }
}
