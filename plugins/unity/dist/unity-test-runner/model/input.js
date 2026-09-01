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
const unity_version_parser_1 = __importDefault(require("./unity-version-parser"));
const fs_1 = __importDefault(require("fs"));
const core_1 = require("@actions/core");
const os_1 = __importDefault(require("os"));
const core = __importStar(require("@actions/core"));
class Input {
    static get testModes() {
        return ['all', 'playmode', 'editmode', 'standalone'];
    }
    static isValidFolderName(folderName) {
        const validFolderName = new RegExp(/^(\.|\.\/)?(\.?[\w~]+([ _-]?[\w~]+)*\/?)*$/);
        return validFolderName.test(folderName);
    }
    static isValidGlobalFolderName(folderName) {
        const validFolderName = new RegExp(/^(\.|\.\/|\/)?(\.?[\w~]+([ _-]?[\w~]+)*\/?)*$/);
        return validFolderName.test(folderName);
    }
    /**
     * When in package mode, we need to scrape the package's name from its package.json file
     */
    static getPackageNameFromPackageJson(packagePath) {
        const packageJsonPath = `${packagePath}/package.json`;
        if (!fs_1.default.existsSync(packageJsonPath)) {
            throw new Error(`Invalid projectPath - Cannot find package.json at ${packageJsonPath}`);
        }
        let packageJson;
        try {
            packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath).toString());
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                throw new SyntaxError(`Unable to parse package.json contents as JSON - ${error.message}`);
            }
            throw new Error(`Unable to parse package.json contents as JSON - unknown error ocurred`, {
                cause: error,
            });
        }
        const rawPackageName = packageJson.name;
        if (typeof rawPackageName !== 'string') {
            throw new TypeError(`Unable to parse package name from package.json - package name should be string, but was ${typeof rawPackageName}`);
        }
        if (rawPackageName.length === 0) {
            throw new Error(`Package name from package.json is a string, but is empty`);
        }
        return rawPackageName;
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
    /**
     * When in package mode, we need to ensure that the Tests folder is present
     */
    static verifyTestsFolderIsPresent(packagePath) {
        if (!fs_1.default.existsSync(`${packagePath}/Tests`)) {
            throw new Error(`Invalid projectPath - Cannot find package tests folder at ${packagePath}/Tests`);
        }
    }
    static getFromUser() {
        // Input variables specified in workflow using "with" prop.
        const unityVersion = (0, core_1.getInput)('unityVersion') || 'auto';
        const customImage = (0, core_1.getInput)('customImage') || '';
        const rawProjectPath = (0, core_1.getInput)('projectPath') || '.';
        const unityLicensingServer = (0, core_1.getInput)('unityLicensingServer') || '';
        const unityLicense = (0, core_1.getInput)('unityLicense') || (process.env['UNITY_LICENSE'] ?? '');
        let unitySerial = process.env['UNITY_SERIAL'] ?? '';
        const customParameters = (0, core_1.getInput)('customParameters') || '';
        const testMode = ((0, core_1.getInput)('testMode') || 'all').toLowerCase();
        const coverageOptions = (0, core_1.getInput)('coverageOptions') || '';
        const rawArtifactsPath = (0, core_1.getInput)('artifactsPath') || 'artifacts';
        const rawUseHostNetwork = (0, core_1.getInput)('useHostNetwork') || 'false';
        const sshAgent = (0, core_1.getInput)('sshAgent') || '';
        const rawSshPublicKeysDirectoryPath = (0, core_1.getInput)('sshPublicKeysDirectoryPath') || '';
        const gitPrivateToken = (0, core_1.getInput)('gitPrivateToken') || '';
        const githubToken = (0, core_1.getInput)('githubToken') || '';
        const checkName = (0, core_1.getInput)('checkName') || 'Test Results';
        const rawPackageMode = (0, core_1.getInput)('packageMode') || 'false';
        let packageName = '';
        const scopedRegistryUrl = (0, core_1.getInput)('scopedRegistryUrl') || '';
        const rawScopes = (0, core_1.getInput)('registryScopes') || '';
        let registryScopes = [];
        const chownFilesTo = (0, core_1.getInput)('chownFilesTo') || '';
        const dockerCpuLimit = (0, core_1.getInput)('dockerCpuLimit') || os_1.default.cpus().length.toString();
        const bytesInMegabyte = 1024 * 1024;
        let memoryMultiplier;
        switch (os_1.default.platform()) {
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
        const dockerMemoryLimit = (0, core_1.getInput)('dockerMemoryLimit') ||
            `${Math.floor((os_1.default.totalmem() / bytesInMegabyte) * memoryMultiplier)}m`;
        // Unity 6.6+ editors request 1GiB of shared memory and fail against
        // Docker's 64m default (game-ci/unity-test-runner#307). 1025m was
        // previously hardcoded into the docker command; it is the default here so
        // behaviour is unchanged, but now overridable. '0'/'none' omits the flag.
        const dockerShmSize = (0, core_1.getInput)('dockerShmSize') || '1025m';
        const dockerIsolationMode = (0, core_1.getInput)('dockerIsolationMode') || 'default';
        const runAsHostUser = (0, core_1.getInput)('runAsHostUser') || 'false';
        const containerRegistryRepository = (0, core_1.getInput)('containerRegistryRepository') || 'unityci/editor';
        const containerRegistryImageVersion = (0, core_1.getInput)('containerRegistryImageVersion') || '3';
        // Validate input
        if (!this.testModes.includes(testMode)) {
            throw new Error(`Invalid testMode ${testMode}`);
        }
        if (!this.isValidFolderName(rawProjectPath)) {
            throw new Error(`Invalid projectPath "${rawProjectPath}"`);
        }
        if (!this.isValidFolderName(rawArtifactsPath)) {
            throw new Error(`Invalid artifactsPath "${rawArtifactsPath}"`);
        }
        if (!this.isValidGlobalFolderName(rawSshPublicKeysDirectoryPath)) {
            throw new Error(`Invalid sshPublicKeysDirectoryPath "${rawSshPublicKeysDirectoryPath}"`);
        }
        if (rawUseHostNetwork !== 'true' && rawUseHostNetwork !== 'false') {
            throw new Error(`Invalid useHostNetwork "${rawUseHostNetwork}"`);
        }
        if (rawPackageMode !== 'true' && rawPackageMode !== 'false') {
            throw new Error(`Invalid packageMode "${rawPackageMode}"`);
        }
        if (rawSshPublicKeysDirectoryPath !== '' && sshAgent === '') {
            throw new Error('sshPublicKeysDirectoryPath is set, but sshAgent is not set. sshPublicKeysDirectoryPath is useful only when using sshAgent.');
        }
        // sanitize packageMode input and projectPath input since they are needed
        // for input validation
        const packageMode = rawPackageMode === 'true';
        const projectPath = rawProjectPath.replace(/\/$/, '');
        // if in package mode, attempt to get the package's name, and ensure tests are present
        if (packageMode) {
            if (unityVersion === 'auto') {
                throw new Error('Package Mode is enabled, but unityVersion is set to "auto". unityVersion must manually be set in Package Mode.');
            }
            packageName = this.getPackageNameFromPackageJson(projectPath);
            this.verifyTestsFolderIsPresent(projectPath);
            if (scopedRegistryUrl !== '') {
                if (rawScopes === '') {
                    throw new Error('Scoped registry is set, but registryScopes is not set. registryScopes is required when using scopedRegistryUrl.');
                }
                registryScopes = rawScopes.split(',').map((scope) => scope.trim());
            }
        }
        if (runAsHostUser !== 'true' && runAsHostUser !== 'false') {
            throw new Error(`Invalid runAsHostUser "${runAsHostUser}"`);
        }
        if (unityLicensingServer === '' && !unitySerial) {
            // No serial was present, so it is a personal license that we need to convert
            if (!unityLicense) {
                throw new Error(`Missing Unity License File and no Serial was found. If this
                            is a personal license, make sure to follow the activation
                            steps and set the UNITY_LICENSE GitHub secret or enter a Unity
                            serial number inside the UNITY_SERIAL GitHub secret.`);
            }
            unitySerial = this.getSerialFromLicenseFile(unityLicense);
        }
        if (unitySerial !== undefined && unitySerial.length === 27) {
            core.setSecret(unitySerial);
            core.setSecret(`${unitySerial.slice(0, -4)}XXXX`);
        }
        // Sanitise other input
        const artifactsPath = rawArtifactsPath.replace(/\/$/, '');
        const sshPublicKeysDirectoryPath = rawSshPublicKeysDirectoryPath.replace(/\/$/, '');
        const useHostNetwork = rawUseHostNetwork === 'true';
        const editorVersion = unityVersion === 'auto' ? unity_version_parser_1.default.read(projectPath) : unityVersion;
        // Return sanitised input
        return {
            editorVersion,
            customImage,
            projectPath,
            customParameters,
            testMode,
            coverageOptions,
            artifactsPath,
            useHostNetwork,
            sshAgent,
            sshPublicKeysDirectoryPath,
            gitPrivateToken,
            githubToken,
            checkName,
            packageMode,
            packageName,
            scopedRegistryUrl,
            registryScopes,
            chownFilesTo,
            dockerCpuLimit,
            dockerMemoryLimit,
            dockerShmSize,
            dockerIsolationMode,
            unityLicensingServer,
            runAsHostUser,
            containerRegistryRepository,
            containerRegistryImageVersion,
            unitySerial,
        };
    }
}
exports.default = Input;
