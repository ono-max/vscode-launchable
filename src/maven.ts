import { getSubsetPath, getTestRunnerPath } from "./utils";

export class Maven implements TestRunner {
    name: string;
    testCasePath: string;
    testReportPath: string;
    subsetPath: string;
    runningTestCmd: string;

    constructor(tempDir: string) {
        this.name = "maven";
        this.testCasePath = getTestRunnerPath() || "src/test/java";
        const testRunnerPath = getTestRunnerPath() || "mvn";
        this.subsetPath = getSubsetPath(tempDir);
        this.testReportPath = "target/surefire-reports/*.xml";
        this.runningTestCmd = `${testRunnerPath} test -Dsurefire.includesFile=${this.subsetPath}`;
    }
}
