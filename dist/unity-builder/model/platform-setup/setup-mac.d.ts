import { BuildParameters } from '..';
declare class SetupMac {
    static unityHubBasePath: string;
    static unityHubExecPath: string;
    static setup(buildParameters: BuildParameters, actionFolder: string): Promise<void>;
    private static installUnityHub;
    /**
     * Gets the latest version of Unity Hub available on brew
     * @returns The latest version of Unity Hub available on brew
     */
    private static getLatestUnityHubVersion;
    private static getArchitectureParameters;
    private static getModuleParametersForTargetPlatform;
    private static installUnity;
    private static setEnvironmentVariables;
}
export default SetupMac;
