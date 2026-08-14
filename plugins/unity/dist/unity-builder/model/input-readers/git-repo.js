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
exports.GitRepoReader = void 0;
const node_console_1 = require("node:console");
const node_fs_1 = __importDefault(require("node:fs"));
const node_child_process_1 = require("node:child_process");
const core = __importStar(require("@actions/core"));
const input_1 = __importDefault(require("../input"));
class GitRepoReader {
    static async runCommand(command) {
        return new Promise((resolve, reject) => {
            (0, node_child_process_1.exec)(command, { maxBuffer: 1024 * 10000 }, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout.toString());
            });
        });
    }
    static async GetRemote() {
        if ((input_1.default.getInput('providerStrategy') || 'local') === 'local') {
            return '';
        }
        (0, node_console_1.assert)(node_fs_1.default.existsSync(`.git`));
        const value = (await GitRepoReader.runCommand(`cd ${input_1.default.projectPath} && git remote -v`)).replace(/ /g, ``);
        core.info(`value ${value}`);
        (0, node_console_1.assert)(value.includes('github.com'));
        return value.split('github.com')[1].split('.git')[0].slice(1);
    }
    static async GetBranch() {
        if ((input_1.default.getInput('providerStrategy') || 'local') === 'local') {
            return '';
        }
        (0, node_console_1.assert)(node_fs_1.default.existsSync(`.git`));
        return (await GitRepoReader.runCommand(`cd ${input_1.default.projectPath} && git branch --show-current`))
            .split('\n')[0]
            .replace(/ /g, ``)
            .replace('/head', '');
    }
}
exports.GitRepoReader = GitRepoReader;
