"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockGetFromUser = void 0;
const vitest_1 = require("vitest");
// Import this named export into your test file:
const platform_1 = __importDefault(require("../platform"));
exports.mockGetFromUser = vitest_1.vi.fn().mockResolvedValue({
    editorVersion: '',
    targetPlatform: platform_1.default.types.Test,
    projectPath: '.',
    buildName: platform_1.default.types.Test,
    buildsPath: 'build',
    buildMethod: undefined,
    buildVersion: '1.3.37',
    customParameters: '',
    sshAgent: '',
    chownFilesTo: '',
    gitPrivateToken: '',
});
exports.default = {
    getFromUser: exports.mockGetFromUser,
};
