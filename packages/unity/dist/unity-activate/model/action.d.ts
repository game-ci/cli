declare const Action: {
    readonly supportedPlatforms: string[];
    readonly isRunningLocally: boolean;
    readonly isRunningFromSource: boolean;
    readonly canonicalName: string;
    readonly rootFolder: string;
    readonly actionFolder: string;
    readonly dockerfile: string;
    readonly workspace: string | undefined;
    checkCompatibility(): void;
};
export default Action;
