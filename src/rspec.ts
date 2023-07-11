import { getTestRunnerPath } from "./utils";

export class Rspec implements TestRunner {
    name: string;
    testCasePath: string;
    testRunnerPath: string;
    testReportPath: string;
    subsetPath: string;
    runningTestCmd: string;

    constructor(tempDir: string) {
        this.name = "rspec";
        this.testCasePath = getTestRunnerPath() || "spec/**/*_spec.rb";
        this.testRunnerPath = getTestRunnerPath() || "rspec";
        this.subsetPath = tempDir + "/" + "subset-" + Date.now().toString() + ".txt";
        this.testReportPath = tempDir + "/" + "report-" + Date.now().toString() + ".txt";
        this.runningTestCmd = `bundle exec rspec $(cat ${this.subsetPath}) --format d --format RspecJunitFormatter --out ${this.testReportPath}`;
    }
}
