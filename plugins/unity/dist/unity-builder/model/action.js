"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
class Action {
    static get supportedPlatforms() {
        return ['linux', 'win32', 'darwin'];
    }
    static get isRunningLocally() {
        return process.env.RUNNER_WORKSPACE === undefined;
    }
    static get isRunningFromSource() {
        return node_path_1.default.basename(__dirname) === 'model';
    }
    static get canonicalName() {
        return 'unity-builder';
    }
    // Path depth updated for this repo's layout: model/action.ts now lives at
    // src/unity-builder/model/action.ts, one level deeper than the original
    // game-ci/unity-builder repo (this repo hosts multiple engines' logic as
    // sibling folders under src/ — see roadmap#11 workstream 2). Source and
    // compiled builds have the same depth here since plain tsc (not a
    // single-file bundler) preserves the src/unity-builder/model/ structure
    // under dist/.
    static get rootFolder() {
        return node_path_1.default.dirname(node_path_1.default.dirname(__filename));
    }
    static get actionFolder() {
        return `${Action.rootFolder}/dist`;
    }
    static get workspace() {
        return process.env.GITHUB_WORKSPACE;
    }
    static checkCompatibility() {
        const currentPlatform = process.platform;
        if (!Action.supportedPlatforms.includes(currentPlatform)) {
            throw new Error(`Currently ${currentPlatform}-platform is not supported`);
        }
    }
}
exports.default = Action;
