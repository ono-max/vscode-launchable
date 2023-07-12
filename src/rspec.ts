import { getTestRunnerPath } from "./utils";

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
        this.subsetPath = tempDir + "/" + "subset-" + Date.now().toString() + ".txt";
        this.testReportPath = tempDir + "/" + "report-" + Date.now().toString() + ".txt";
        this.runningTestCmd = `${testRunnerPath} $(cat ${this.subsetPath}) --format d --format RspecJunitFormatter --out ${this.testReportPath}`;
    }
}
