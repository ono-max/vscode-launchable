interface TestRunner {
    readonly name: string;
    readonly testCasePath: string;
    readonly testRunnerPath: string;
    readonly testReportPath: string;
    readonly subsetPath: string;
    readonly runningTestCmd: string;
}
