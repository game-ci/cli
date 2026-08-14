export interface RunnerContext {
    runnerTemporaryPath: string;
    githubAction: string;
}
declare const Action: {
    readonly supportedPlatforms: string[];
    readonly isRunningLocally: boolean;
    readonly isRunningFromSource: boolean;
    readonly canonicalName: string;
    readonly rootFolder: string;
    readonly actionFolder: string;
    readonly workspace: string | undefined;
    runnerContext(): RunnerContext;
    checkCompatibility(): void;
};
export default Action;
