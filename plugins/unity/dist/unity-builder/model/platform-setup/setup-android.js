"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class SetupAndroid {
    static async setup(buildParameters) {
        const { targetPlatform, androidKeystoreBase64, androidKeystoreName, projectPath } = buildParameters;
        if (targetPlatform === 'Android' &&
            androidKeystoreBase64 !== '' &&
            androidKeystoreName !== '') {
            SetupAndroid.setupAndroidRun(androidKeystoreBase64, androidKeystoreName, projectPath);
        }
    }
    static setupAndroidRun(androidKeystoreBase64, androidKeystoreName, projectPath) {
        const decodedKeystore = Buffer.from(androidKeystoreBase64, 'base64').toString('binary');
        const githubWorkspace = process.env.GITHUB_WORKSPACE || '';
        node_fs_1.default.writeFileSync(node_path_1.default.join(githubWorkspace, projectPath, androidKeystoreName), decodedKeystore, 'binary');
    }
}
exports.default = SetupAndroid;
