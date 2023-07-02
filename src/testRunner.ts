interface TestRunner {
    readonly name: string;
    readonly testCasePath: string;
    readonly testRunnerPath: string;
    readonly testReportPath: string;

    getRunningCommand(subsetPath: string): string;
}
