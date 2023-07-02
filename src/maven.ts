import { getTestRunnerPath } from "./utils";

export class Maven implements TestRunner {
    name: string;
    testCasePath: string;
    testRunnerPath: string;
    testReportPath: string;

    constructor() {
        this.name = "maven";
        this.testCasePath = getTestRunnerPath() || "mvn";
        this.testRunnerPath = getTestRunnerPath() || "src/test/java";
        this.testReportPath = "target/surefire-reports/*.xml";
    }

    getRunningCommand(subsetPath: string) {
        return `${this.testRunnerPath} test -Dsurefire.includesFile=${subsetPath}`;
    }
}
