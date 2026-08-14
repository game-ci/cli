declare class Action {
    static get supportedPlatforms(): string[];
    static get isRunningLocally(): boolean;
    static get isRunningFromSource(): boolean;
    static get canonicalName(): string;
    static get rootFolder(): string;
    static get actionFolder(): string;
    static get workspace(): string;
    static checkCompatibility(): void;
}
export default Action;
