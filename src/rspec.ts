import { getSubsetPath, getTestReportPath, getTestRunnerPath } from "./utils";

export class Rspec implements TestRunner {
    name: string;
    testCasePath: string;
    testReportPath: string;
    subsetPath: string;
    runningTestCmd: string;

    constructor(tempDir: string) {
        this.name = "rspec";
        this.testCasePath = getTestRunnerPath() || "spec/**/*_spec.rb";
        const testRunnerPath = getTestRunnerPath() || "bundle exec rspec";
        this.subsetPath = getSubsetPath(tempDir);
        this.testReportPath = getTestReportPath(tempDir);
        this.runningTestCmd = `${testRunnerPath} $(cat ${this.subsetPath}) --format d --format RspecJunitFormatter --out ${this.testReportPath}`;
    }
}
