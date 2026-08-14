"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const exec_1 = require("@actions/exec");
const node_fs_1 = __importDefault(require("node:fs"));
class SetupWindows {
    static async setup(buildParameters) {
        const { targetPlatform } = buildParameters;
        await SetupWindows.setupWindowsRun(targetPlatform);
    }
    static async setupWindowsRun(targetPlatform, silent = false) {
        if (!node_fs_1.default.existsSync('c:/regkeys')) {
            node_fs_1.default.mkdirSync('c:/regkeys');
        }
        // These all need the Windows 10 SDK
        switch (targetPlatform) {
            case 'StandaloneWindows':
            case 'StandaloneWindows64':
            case 'WSAPlayer':
                await this.generateWinSDKRegKeys(silent);
                break;
        }
    }
    static async generateWinSDKRegKeys(silent = false) {
        // Export registry keys that point to the Windows 10 SDK
        const exportWinSDKRegKeysCommand = 'reg export "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0" c:/regkeys/winsdk.reg /y';
        await (0, exec_1.exec)(exportWinSDKRegKeysCommand, undefined, { silent });
    }
}
exports.default = SetupWindows;
