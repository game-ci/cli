"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class UnityVersioning {
    static determineUnityVersion(projectPath, unityVersion) {
        if (unityVersion === 'auto') {
            return UnityVersioning.read(projectPath);
        }
        return unityVersion;
    }
    static read(projectPath) {
        const filePath = node_path_1.default.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
        if (!node_fs_1.default.existsSync(filePath)) {
            throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
        }
        return UnityVersioning.parse(node_fs_1.default.readFileSync(filePath, 'utf8'));
    }
    static parse(projectVersionTxt) {
        const versionRegex = /m_EditorVersion: (\d+\.\d+\.\d+[A-Za-z]?\d+)/;
        const matches = projectVersionTxt.match(versionRegex);
        if (!matches || matches.length < 2) {
            throw new Error(`Failed to extract version from "${projectVersionTxt}".`);
        }
        return matches[1];
    }
}
exports.default = UnityVersioning;
