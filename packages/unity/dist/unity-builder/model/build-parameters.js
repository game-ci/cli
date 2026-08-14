"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const android_versioning_1 = __importDefault(require("./android-versioning"));
const input_1 = __importDefault(require("./input"));
const platform_1 = __importDefault(require("./platform"));
const unity_versioning_1 = __importDefault(require("./unity-versioning"));
const versioning_1 = __importDefault(require("./versioning"));
const git_repo_1 = require("./input-readers/git-repo");
const github_cli_1 = require("./input-readers/github-cli");
const plugin_options_1 = require("./plugin-options");
const github_1 = __importDefault(require("./github"));
const core = __importStar(require("@actions/core"));
class BuildParameters {
    editorVersion;
    customImage;
    unitySerial;
    unityLicensingServer;
    skipActivation;
    runnerTempPath;
    targetPlatform;
    projectPath;
    buildProfile;
    buildName;
    buildPath;
    buildFile;
    buildMethod;
    buildVersion;
    manualExit;
    enableGpu;
    androidVersionCode;
    androidKeystoreName;
    androidKeystoreBase64;
    androidKeystorePass;
    androidKeyaliasName;
    androidKeyaliasPass;
    androidTargetSdkVersion;
    androidSdkManagerParameters;
    androidExportType;
    androidSymbolType;
    dockerCpuLimit;
    dockerMemoryLimit;
    dockerIsolationMode;
    containerRegistryRepository;
    containerRegistryImageVersion;
    customParameters;
    useHostNetwork;
    sshAgent;
    sshPublicKeysDirectoryPath;
    providerStrategy;
    gitPrivateToken;
    runAsHostUser;
    chownFilesTo;
    runNumber;
    branch;
    githubRepo;
    gitSha;
    logId;
    buildGuid;
    buildPlatform;
    isCliMode;
    cacheUnityInstallationOnMac;
    unityHubVersionOnMac;
    dockerWorkspacePath;
    static async create() {
        const buildFile = this.parseBuildFile(input_1.default.buildName, input_1.default.targetPlatform, input_1.default.androidExportType, input_1.default.linux64RemoveExecutableExtension);
        const editorVersion = unity_versioning_1.default.determineUnityVersion(input_1.default.projectPath, input_1.default.unityVersion);
        const buildVersion = await versioning_1.default.determineBuildVersion(input_1.default.versioningStrategy, input_1.default.specifiedVersion);
        const androidVersionCode = android_versioning_1.default.determineVersionCode(buildVersion, input_1.default.androidVersionCode);
        const androidSdkManagerParameters = android_versioning_1.default.determineSdkManagerParameters(input_1.default.androidTargetSdkVersion);
        const androidSymbolExportType = input_1.default.androidSymbolType;
        if (platform_1.default.isAndroid(input_1.default.targetPlatform)) {
            switch (androidSymbolExportType) {
                case 'none':
                case 'public':
                case 'debugging':
                    break;
                default:
                    throw new Error(`Invalid androidSymbolType: ${input_1.default.androidSymbolType}. Must be one of: none, public, debugging`);
            }
        }
        let unitySerial = '';
        if (input_1.default.unityLicensingServer === '') {
            if (!input_1.default.unitySerial && github_1.default.githubInputEnabled) {
                // No serial was present, so it is a personal license that we need to convert
                if (!input_1.default.unityLicense) {
                    throw new Error(`Missing Unity License File and no Serial was found. If this
                            is a personal license, make sure to follow the activation
                            steps and set the UNITY_LICENSE GitHub secret or enter a Unity
                            serial number inside the UNITY_SERIAL GitHub secret.`);
                }
                unitySerial = this.getSerialFromLicenseFile(input_1.default.unityLicense);
            }
            else {
                unitySerial = input_1.default.unitySerial;
            }
        }
        if (unitySerial !== undefined && unitySerial.length === 27) {
            core.setSecret(unitySerial);
            core.setSecret(`${unitySerial.slice(0, -4)}XXXX`);
        }
        const providerStrategy = input_1.default.getInput('providerStrategy') || (plugin_options_1.PluginOptions.isPluginMode ? 'aws' : 'local');
        return {
            editorVersion,
            customImage: input_1.default.customImage,
            unitySerial,
            unityLicensingServer: input_1.default.unityLicensingServer,
            skipActivation: input_1.default.skipActivation,
            runnerTempPath: input_1.default.runnerTempPath,
            targetPlatform: input_1.default.targetPlatform,
            projectPath: input_1.default.projectPath,
            buildProfile: input_1.default.buildProfile,
            buildName: input_1.default.buildName,
            buildPath: `${input_1.default.buildsPath}/${input_1.default.targetPlatform}`,
            buildFile,
            buildMethod: input_1.default.buildMethod,
            buildVersion,
            manualExit: input_1.default.manualExit,
            enableGpu: input_1.default.enableGpu,
            androidVersionCode,
            androidKeystoreName: input_1.default.androidKeystoreName,
            androidKeystoreBase64: input_1.default.androidKeystoreBase64,
            androidKeystorePass: input_1.default.androidKeystorePass,
            androidKeyaliasName: input_1.default.androidKeyaliasName,
            androidKeyaliasPass: input_1.default.androidKeyaliasPass,
            androidTargetSdkVersion: input_1.default.androidTargetSdkVersion,
            androidSdkManagerParameters,
            androidExportType: input_1.default.androidExportType,
            androidSymbolType: androidSymbolExportType,
            customParameters: input_1.default.customParameters,
            useHostNetwork: input_1.default.useHostNetwork,
            sshAgent: input_1.default.sshAgent,
            sshPublicKeysDirectoryPath: input_1.default.sshPublicKeysDirectoryPath,
            gitPrivateToken: input_1.default.gitPrivateToken ?? (await github_cli_1.GithubCliReader.GetGitHubAuthToken()),
            runAsHostUser: input_1.default.runAsHostUser,
            chownFilesTo: input_1.default.chownFilesTo,
            dockerCpuLimit: input_1.default.dockerCpuLimit,
            dockerMemoryLimit: input_1.default.dockerMemoryLimit,
            dockerIsolationMode: input_1.default.dockerIsolationMode,
            containerRegistryRepository: input_1.default.containerRegistryRepository,
            containerRegistryImageVersion: input_1.default.containerRegistryImageVersion,
            providerStrategy,
            buildPlatform: providerStrategy !== 'local' ? 'linux' : process.platform,
            runNumber: input_1.default.runNumber,
            branch: input_1.default.branch.replace('/head', '') || (await git_repo_1.GitRepoReader.GetBranch()),
            githubRepo: (input_1.default.githubRepo ?? (await git_repo_1.GitRepoReader.GetRemote())) || 'game-ci/unity-builder',
            gitSha: input_1.default.gitSha,
            logId: (0, nanoid_1.customAlphabet)('0123456789abcdefghijklmnopqrstuvwxyz', 9)(),
            buildGuid: `${input_1.default.runNumber}-${input_1.default.targetPlatform.toLowerCase().replace('standalone', '')}-${(0, nanoid_1.customAlphabet)('0123456789abcdefghijklmnopqrstuvwxyz', 4)()}`,
            isCliMode: plugin_options_1.PluginOptions.isPluginMode,
            cacheUnityInstallationOnMac: input_1.default.cacheUnityInstallationOnMac,
            unityHubVersionOnMac: input_1.default.unityHubVersionOnMac,
            dockerWorkspacePath: input_1.default.dockerWorkspacePath,
        };
    }
    static parseBuildFile(filename, platform, androidExportType, linux64RemoveExecutableExtension) {
        if (platform_1.default.isWindows(platform)) {
            return `${filename}.exe`;
        }
        if (platform_1.default.isAndroid(platform)) {
            switch (androidExportType) {
                case `androidPackage`:
                    return `${filename}.apk`;
                case `androidAppBundle`:
                    return `${filename}.aab`;
                case `androidStudioProject`:
                    return filename;
                default:
                    throw new Error(`Unknown Android Export Type: ${androidExportType}. Must be one of androidPackage for apk, androidAppBundle for aab, androidStudioProject for android project`);
            }
        }
        if (platform === platform_1.default.types.StandaloneLinux64 && !linux64RemoveExecutableExtension) {
            return `${filename}.x86_64`;
        }
        return filename;
    }
    static getSerialFromLicenseFile(license) {
        const startKey = `<DeveloperData Value="`;
        const endKey = `"/>`;
        const startIndex = license.indexOf(startKey) + startKey.length;
        if (startIndex < 0) {
            throw new Error(`License File was corrupted, unable to locate serial`);
        }
        const endIndex = license.indexOf(endKey, startIndex);
        // Slice off the first 4 characters as they are garbage values
        return Buffer.from(license.slice(startIndex, endIndex), 'base64').toString('binary').slice(4);
    }
}
exports.default = BuildParameters;
