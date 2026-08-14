"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const Action = {
    get supportedPlatforms() {
        return ['linux', 'win32'];
    },
    get isRunningLocally() {
        return process.env.RUNNER_WORKSPACE === undefined;
    },
    get isRunningFromSource() {
        return path_1.default.basename(__dirname) === 'model';
    },
    get canonicalName() {
        return 'unity-test-runner';
    },
    // Path depth updated for this repo's layout: model/action.ts now lives at
    // src/unity-test-runner/model/action.ts, one level deeper than the
    // original game-ci/unity-test-runner repo (this repo hosts multiple
    // engines' logic as sibling folders under src/ — see roadmap#11
    // workstream 2). Source and compiled builds have the same depth here
    // since plain tsc (not a single-file bundler) preserves the
    // src/unity-test-runner/model/ structure under dist/.
    get rootFolder() {
        return path_1.default.dirname(path_1.default.dirname(__filename));
    },
    get actionFolder() {
        return `${Action.rootFolder}/dist`;
    },
    get workspace() {
        return process.env.GITHUB_WORKSPACE;
    },
    runnerContext() {
        const runnerTemporaryPath = process.env.RUNNER_TEMP ?? process.cwd();
        const githubAction = process.env.GITHUB_ACTION ?? process.pid.toString();
        return {
            runnerTemporaryPath,
            githubAction,
        };
    },
    checkCompatibility() {
        const currentPlatform = process.platform;
        if (!Action.supportedPlatforms.includes(currentPlatform)) {
            throw new Error(`Currently ${currentPlatform}-platform is not supported`);
        }
    },
};
exports.default = Action;
