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
exports.GithubCliReader = void 0;
const node_child_process_1 = require("node:child_process");
const core = __importStar(require("@actions/core"));
const input_1 = __importDefault(require("../input"));
class GithubCliReader {
    static async runCommand(command, suppressError = false) {
        return new Promise((resolve, reject) => {
            (0, node_child_process_1.exec)(command, { maxBuffer: 1024 * 10000 }, (error, stdout, stderr) => {
                if (error && !suppressError) {
                    reject(error);
                    return;
                }
                resolve((stdout || '').toString() + (stderr || '').toString());
            });
        });
    }
    static async GetGitHubAuthToken() {
        if ((input_1.default.getInput('providerStrategy') || 'local') === 'local') {
            return '';
        }
        try {
            const authStatus = await GithubCliReader.runCommand(`gh auth status`, true);
            if (authStatus.includes('You are not logged') || authStatus === '') {
                return '';
            }
            return (await GithubCliReader.runCommand(`gh auth status -t`))
                .split(`Token: `)[1]
                .replace(/ /g, '')
                .replace(/\n/g, '');
        }
        catch (error) {
            core.info(error || 'Failed to get github auth token from gh cli');
            return '';
        }
    }
}
exports.GithubCliReader = GithubCliReader;
