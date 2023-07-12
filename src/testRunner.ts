interface TestRunner {
    readonly name: string;
    readonly testCasePath: string;
    readonly testReportPath: string;
    readonly subsetPath: string;
    readonly runningTestCmd: string;
}
