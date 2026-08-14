"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
class ValidateWindows {
    static validate(buildParameters) {
        ValidateWindows.validateWindowsPlatformRequirements(buildParameters.targetPlatform);
        const { unityLicensingServer } = buildParameters;
        const hasLicensingCredentials = process.env.UNITY_EMAIL && process.env.UNITY_PASSWORD;
        const hasValidLicensingStrategy = hasLicensingCredentials || unityLicensingServer;
        if (!hasValidLicensingStrategy) {
            throw new Error(`Unity email and password or alternatively a Unity licensing server url must be set for 
                       Windows based builds to authenticate the license. Make sure to set them inside UNITY_EMAIL
                       and UNITY_PASSWORD in Github Secrets and pass them into the environment.`);
        }
    }
    static validateWindowsPlatformRequirements(platform) {
        switch (platform) {
            case 'StandaloneWindows':
            case 'StandaloneWindows64':
            case 'WSAPlayer':
                this.checkForVisualStudio();
                this.checkForWin10SDK();
                break;
            case 'tvOS':
                this.checkForVisualStudio();
                break;
        }
    }
    static checkForWin10SDK() {
        // Check for Windows 10 SDK on runner
        const windows10SDKPathExists = node_fs_1.default.existsSync('C:/Program Files (x86)/Windows Kits');
        if (!windows10SDKPathExists) {
            throw new Error(`Windows 10 SDK not found in default location. Make sure
                      the runner has a Windows 10 SDK installed in the default
                      location.`);
        }
    }
    static checkForVisualStudio() {
        // Note: When upgrading to Server 2022, we will need to move to just "program files" since VS will be 64-bit
        const visualStudioInstallPathExists = node_fs_1.default.existsSync('C:/Program Files (x86)/Microsoft Visual Studio');
        const visualStudioDataPathExists = node_fs_1.default.existsSync('C:/ProgramData/Microsoft/VisualStudio');
        if (!visualStudioInstallPathExists || !visualStudioDataPathExists) {
            throw new Error(`Visual Studio not found at the default location.
              Make sure the runner has Visual Studio installed in the
              default location`);
        }
    }
}
exports.default = ValidateWindows;
