"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const UnityVersionParser = {
    parse(projectVersionTxt) {
        const versionRegex = /m_EditorVersion: (\d+\.\d+\.\d+[A-Za-z]?\d+)/;
        const matches = projectVersionTxt.match(versionRegex);
        if (!matches || matches.length < 2) {
            throw new Error(`Failed to extract version from "${projectVersionTxt}".`);
        }
        return matches[1];
    },
    read(projectPath) {
        const filePath = path_1.default.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
        }
        return UnityVersionParser.parse(fs_1.default.readFileSync(filePath, 'utf8'));
    },
};
exports.default = UnityVersionParser;
