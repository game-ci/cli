export type InputKey = keyof typeof Input;
/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 *
 * Only core build inputs belong here. Orchestrator/plugin inputs are read
 * directly by the @game-ci/orchestrator plugin via core.getInput() / env vars.
 */
declare class Input {
    static getInput(query: string): string | undefined;
    static get githubRepo(): string | undefined;
    static get branch(): string;
    static get gitSha(): string;
    static get runNumber(): string;
    static get targetPlatform(): string;
    static get unityVersion(): string;
    static get customImage(): string;
    static get projectPath(): string;
    static get buildProfile(): string;
    static get runnerTempPath(): string;
    static get buildName(): string;
    static get buildsPath(): string;
    static get unityLicensingServer(): string;
    static get buildMethod(): string;
    static get manualExit(): boolean;
    static get enableGpu(): boolean;
    static get customParameters(): string;
    static get useHostNetwork(): boolean;
    static get versioningStrategy(): string;
    static get specifiedVersion(): string;
    static get androidVersionCode(): string;
    static get androidExportType(): string;
    static get androidKeystoreName(): string;
    static get androidKeystoreBase64(): string;
    static get androidKeystorePass(): string;
    static get androidKeyaliasName(): string;
    static get androidKeyaliasPass(): string;
    static get androidTargetSdkVersion(): string;
    static get androidSymbolType(): string;
    static get sshAgent(): string;
    static get sshPublicKeysDirectoryPath(): string;
    static get gitPrivateToken(): string | undefined;
    static get runAsHostUser(): string;
    static get chownFilesTo(): string;
    static get allowDirtyBuild(): boolean;
    static get cacheUnityInstallationOnMac(): boolean;
    static get unityHubVersionOnMac(): string;
    static get unitySerial(): string | undefined;
    static get unityLicense(): string | undefined;
    static get dockerWorkspacePath(): string;
    static get dockerCpuLimit(): string;
    /**
     * Unity 6.6+ editors request 1GiB of shared memory and hard-fail with
     * "Insufficient shared memory available" against Docker's 64m default
     * (game-ci/unity-builder#840). unity-test-runner has always passed 1025m,
     * so match it here rather than leaving builds broken by default. "0" or
     * "none" omits the flag and uses Docker's own default.
     */
    static get dockerShmSize(): string;
    static get dockerMemoryLimit(): string;
    static get dockerIsolationMode(): string;
    static get containerOs(): string;
    static get containerRegistryRepository(): string;
    static get containerRegistryImageVersion(): string;
    static get skipActivation(): string;
    static get linux64RemoveExecutableExtension(): boolean;
    static ToEnvVarFormat(input: string): string;
}
export default Input;
