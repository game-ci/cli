"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const Action = {
    get supportedPlatforms() {
        return ['linux'];
    },
    get isRunningLocally() {
        return process.env.RUNNER_WORKSPACE === undefined;
    },
    get isRunningFromSource() {
        return path_1.default.basename(__dirname) === 'model';
    },
    get canonicalName() {
        return 'unity-activate';
    },
    // Path depth updated for this repo's layout: model/action.ts now lives at
    // src/unity-activate/model/action.ts (one level deeper than the original
    // game-ci/unity-activate repo, since this repo hosts multiple engines'
    // logic as sibling folders under src/ — see roadmap#11 workstream 2).
    // rootFolder resolves to src/unity-activate/, treated as this engine's
    // self-contained root (with its own dist/ holding Dockerfile/entrypoint.sh),
    // not the whole unity-engine-core repo root.
    get rootFolder() {
        // Source and compiled builds have the same depth here since plain tsc
        // (not a single-file bundler) preserves the src/unity-activate/model/
        // structure under dist/ — no branch needed, unlike the original repo.
        return path_1.default.dirname(path_1.default.dirname(__filename));
    },
    get actionFolder() {
        return `${Action.rootFolder}/dist`;
    },
    get dockerfile() {
        return `${Action.actionFolder}/Dockerfile`;
    },
    get workspace() {
        return process.env.GITHUB_WORKSPACE;
    },
    checkCompatibility() {
        const currentPlatform = process.platform;
        if (!Action.supportedPlatforms.includes(currentPlatform)) {
            throw new Error(`Currently ${currentPlatform}-platform is not supported`);
        }
    },
};
exports.default = Action;
