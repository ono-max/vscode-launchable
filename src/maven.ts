import { getTestRunnerPath } from "./utils";

export class Maven implements TestRunner {
    name: string;
    testCasePath: string;
    testRunnerPath: string;
    testReportPath: string;

    constructor() {
        this.name = "maven";
        this.testCasePath = getTestRunnerPath() || "src/test/java";
        this.testRunnerPath = getTestRunnerPath() || "mvn";
        this.testReportPath = "target/surefire-reports/*.xml";
    }

    getRunningCommand(subsetPath: string) {
        return `${this.testRunnerPath} test -Dsurefire.includesFile=${subsetPath}`;
    }
}
