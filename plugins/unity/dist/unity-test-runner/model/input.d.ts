declare class Input {
    static get testModes(): string[];
    static isValidFolderName(folderName: any): boolean;
    static isValidGlobalFolderName(folderName: any): boolean;
    /**
     * When in package mode, we need to scrape the package's name from its package.json file
     */
    static getPackageNameFromPackageJson(packagePath: any): string;
    private static getSerialFromLicenseFile;
    /**
     * When in package mode, we need to ensure that the Tests folder is present
     */
    static verifyTestsFolderIsPresent(packagePath: any): void;
    static getFromUser(): {
        editorVersion: any;
        customImage: string;
        projectPath: string;
        customParameters: string;
        testMode: string;
        coverageOptions: string;
        artifactsPath: string;
        useHostNetwork: boolean;
        sshAgent: string;
        sshPublicKeysDirectoryPath: string;
        gitPrivateToken: string;
        githubToken: string;
        checkName: string;
        packageMode: boolean;
        packageName: string;
        scopedRegistryUrl: string;
        registryScopes: string[];
        chownFilesTo: string;
        dockerCpuLimit: string;
        dockerMemoryLimit: string;
        dockerShmSize: string;
        dockerIsolationMode: string;
        unityLicensingServer: string;
        runAsHostUser: string;
        containerRegistryRepository: string;
        containerRegistryImageVersion: string;
        unitySerial: string;
    };
}
export default Input;
