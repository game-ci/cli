declare class Output {
    static setBuildVersion(buildVersion: string): Promise<void>;
    static setAndroidVersionCode(androidVersionCode: string): Promise<void>;
    static setEngineExitCode(exitCode: number): Promise<void>;
}
export default Output;
