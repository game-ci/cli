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
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const plugin_options_1 = require("./plugin-options");
const platform_1 = __importDefault(require("./platform"));
const github_1 = __importDefault(require("./github"));
const node_os_1 = __importDefault(require("node:os"));
const core = __importStar(require("@actions/core"));
/**
 * Input variables specified in workflows using "with" prop.
 *
 * Note that input is always passed as a string, even booleans.
 *
 * Only core build inputs belong here. Orchestrator/plugin inputs are read
 * directly by the @game-ci/orchestrator plugin via core.getInput() / env vars.
 */
class Input {
    static getInput(query) {
        if (github_1.default.githubInputEnabled) {
            const coreInput = core.getInput(query);
            if (coreInput && coreInput !== '') {
                return coreInput;
            }
        }
        const alternativeQuery = Input.ToEnvVarFormat(query);
        // Query input sources
        if (plugin_options_1.PluginOptions.query(query, alternativeQuery)) {
            return plugin_options_1.PluginOptions.query(query, alternativeQuery);
        }
        if (process.env[query] !== undefined) {
            return process.env[query];
        }
        if (alternativeQuery !== query && process.env[alternativeQuery] !== undefined) {
            return process.env[alternativeQuery];
        }
    }
    static get githubRepo() {
        return Input.getInput('GITHUB_REPOSITORY') ?? Input.getInput('GITHUB_REPO') ?? undefined;
    }
    static get branch() {
        if (Input.getInput(`GITHUB_REF`)) {
            return Input.getInput(`GITHUB_REF`)
                .replace('refs/', '')
                .replace(`head/`, '')
                .replace(`heads/`, '');
        }
        else if (Input.getInput('branch')) {
            return Input.getInput('branch');
        }
        else {
            return '';
        }
    }
    static get gitSha() {
        if (Input.getInput(`GITHUB_SHA`)) {
            return Input.getInput(`GITHUB_SHA`);
        }
        else if (Input.getInput(`GitSHA`)) {
            return Input.getInput(`GitSHA`);
        }
        return '';
    }
    static get runNumber() {
        return Input.getInput('GITHUB_RUN_NUMBER') ?? '0';
    }
    static get targetPlatform() {
        return Input.getInput('targetPlatform') ?? platform_1.default.default;
    }
    static get unityVersion() {
        return Input.getInput('unityVersion') ?? 'auto';
    }
    static get customImage() {
        return Input.getInput('customImage') ?? '';
    }
    static get projectPath() {
        const input = Input.getInput('projectPath');
        let rawProjectPath;
        if (input) {
            rawProjectPath = input;
        }
        else if (node_fs_1.default.existsSync(node_path_1.default.join('test-project', 'ProjectSettings', 'ProjectVersion.txt')) &&
            !node_fs_1.default.existsSync(node_path_1.default.join('ProjectSettings', 'ProjectVersion.txt'))) {
            rawProjectPath = 'test-project';
        }
        else {
            rawProjectPath = '.';
        }
        return rawProjectPath.replace(/\/$/, '');
    }
    static get buildProfile() {
        return Input.getInput('buildProfile') ?? '';
    }
    static get runnerTempPath() {
        return Input.getInput('RUNNER_TEMP') ?? '';
    }
    static get buildName() {
        return Input.getInput('buildName') ?? Input.targetPlatform;
    }
    static get buildsPath() {
        return Input.getInput('buildsPath') ?? 'build';
    }
    static get unityLicensingServer() {
        return Input.getInput('unityLicensingServer') ?? '';
    }
    static get buildMethod() {
        return Input.getInput('buildMethod') ?? ''; // Processed in docker file
    }
    static get manualExit() {
        const input = Input.getInput('manualExit') ?? false;
        return input === 'true';
    }
    static get enableGpu() {
        const input = Input.getInput('enableGpu') ?? false;
        return input === 'true';
    }
    static get customParameters() {
        return Input.getInput('customParameters') ?? '';
    }
    static get useHostNetwork() {
        const input = Input.getInput('useHostNetwork') ?? false;
        return input === 'true';
    }
    static get versioningStrategy() {
        return Input.getInput('versioning') ?? 'Semantic';
    }
    static get specifiedVersion() {
        return Input.getInput('version') ?? '';
    }
    static get androidVersionCode() {
        return Input.getInput('androidVersionCode') ?? '';
    }
    static get androidExportType() {
        return Input.getInput('androidExportType') ?? 'androidPackage';
    }
    static get androidKeystoreName() {
        return Input.getInput('androidKeystoreName') ?? '';
    }
    static get androidKeystoreBase64() {
        return Input.getInput('androidKeystoreBase64') ?? '';
    }
    static get androidKeystorePass() {
        return Input.getInput('androidKeystorePass') ?? '';
    }
    static get androidKeyaliasName() {
        return Input.getInput('androidKeyaliasName') ?? '';
    }
    static get androidKeyaliasPass() {
        return Input.getInput('androidKeyaliasPass') ?? '';
    }
    static get androidTargetSdkVersion() {
        return Input.getInput('androidTargetSdkVersion') ?? '';
    }
    static get androidSymbolType() {
        return Input.getInput('androidSymbolType') ?? 'none';
    }
    static get sshAgent() {
        return Input.getInput('sshAgent') ?? '';
    }
    static get sshPublicKeysDirectoryPath() {
        return Input.getInput('sshPublicKeysDirectoryPath') ?? '';
    }
    static get gitPrivateToken() {
        return Input.getInput('gitPrivateToken');
    }
    static get runAsHostUser() {
        return Input.getInput('runAsHostUser')?.toLowerCase() ?? 'false';
    }
    static get chownFilesTo() {
        return Input.getInput('chownFilesTo') ?? '';
    }
    static get allowDirtyBuild() {
        const input = Input.getInput('allowDirtyBuild') ?? false;
        return input === 'true';
    }
    static get cacheUnityInstallationOnMac() {
        const input = Input.getInput('cacheUnityInstallationOnMac') ?? false;
        return input === 'true';
    }
    static get unityHubVersionOnMac() {
        const input = Input.getInput('unityHubVersionOnMac') ?? '';
        return input !== '' ? input : '';
    }
    static get unitySerial() {
        return Input.getInput('UNITY_SERIAL');
    }
    static get unityLicense() {
        return Input.getInput('UNITY_LICENSE');
    }
    static get dockerWorkspacePath() {
        return Input.getInput('dockerWorkspacePath') ?? '/github/workspace';
    }
    static get dockerCpuLimit() {
        return Input.getInput('dockerCpuLimit') ?? node_os_1.default.cpus().length.toString();
    }
    /**
     * Unity 6.6+ editors request 1GiB of shared memory and hard-fail with
     * "Insufficient shared memory available" against Docker's 64m default
     * (game-ci/unity-builder#840). unity-test-runner has always passed 1025m,
     * so match it here rather than leaving builds broken by default. "0" or
     * "none" omits the flag and uses Docker's own default.
     */
    static get dockerShmSize() {
        return Input.getInput('dockerShmSize') ?? '1025m';
    }
    static get dockerMemoryLimit() {
        const bytesInMegabyte = 1024 * 1024;
        let memoryMultiplier;
        switch (node_os_1.default.platform()) {
            case 'linux':
                memoryMultiplier = 0.95;
                break;
            case 'win32':
                memoryMultiplier = 0.8;
                break;
            default:
                memoryMultiplier = 0.75;
                break;
        }
        return (Input.getInput('dockerMemoryLimit') ??
            `${Math.floor((node_os_1.default.totalmem() / bytesInMegabyte) * memoryMultiplier)}m`);
    }
    static get dockerIsolationMode() {
        return Input.getInput('dockerIsolationMode') ?? 'default';
    }
    static get containerOs() {
        return Input.getInput('containerOs')?.toLowerCase() ?? 'auto';
    }
    static get containerRegistryRepository() {
        return Input.getInput('containerRegistryRepository') ?? 'unityci/editor';
    }
    static get containerRegistryImageVersion() {
        return Input.getInput('containerRegistryImageVersion') ?? '3';
    }
    static get skipActivation() {
        return Input.getInput('skipActivation')?.toLowerCase() ?? 'false';
    }
    static get linux64RemoveExecutableExtension() {
        const input = Input.getInput('linux64RemoveExecutableExtension') ?? 'false';
        return input === 'true';
    }
    static ToEnvVarFormat(input) {
        if (input.toUpperCase() === input) {
            return input;
        }
        return input
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .toUpperCase()
            .replace(/ /g, '_');
    }
}
exports.default = Input;
