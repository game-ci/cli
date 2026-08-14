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
exports.runMain = runMain;
const core = __importStar(require("@actions/core"));
const model_1 = require("./model");
const mac_builder_1 = __importDefault(require("./model/mac-builder"));
const platform_setup_1 = __importDefault(require("./model/platform-setup"));
const plugin_1 = require("./model/plugin");
// Exported so tests can drive the lifecycle directly without depending on
// vitest's module re-loading (which changed in vitest 4).
async function runMain() {
    try {
        model_1.Action.checkCompatibility();
        model_1.Cache.verify();
        const { workspace, actionFolder } = model_1.Action;
        const buildParameters = await model_1.BuildParameters.create();
        const baseImage = new model_1.ImageTag(buildParameters);
        // Load optional plugin. The default implementation is @game-ci/orchestrator.
        const plugin = await (0, plugin_1.loadPlugin)();
        await plugin?.initialize(buildParameters, workspace);
        let exitCode = -1;
        if (plugin?.canHandleBuild()) {
            // Plugin handles the build entirely (remote providers, hot runner, test workflows)
            const result = await plugin.handleBuild(baseImage.toString());
            exitCode = result.fallbackToLocal
                ? await runLocalBuild(buildParameters, baseImage, workspace, actionFolder, plugin)
                : result.exitCode;
        }
        else if (buildParameters.providerStrategy === 'local') {
            exitCode = await runLocalBuild(buildParameters, baseImage, workspace, actionFolder, plugin);
        }
        else {
            throw new Error(`Provider strategy "${buildParameters.providerStrategy}" requires @game-ci/orchestrator. ` +
                'Install it via the game-ci/orchestrator action, or use providerStrategy=local.');
        }
        // Set core outputs
        await model_1.Output.setBuildVersion(buildParameters.buildVersion);
        await model_1.Output.setAndroidVersionCode(buildParameters.androidVersionCode);
        await model_1.Output.setEngineExitCode(exitCode);
        // Plugin handles post-build (artifacts, archiving, retention)
        await plugin?.handlePostBuild(exitCode);
        if (exitCode !== 0) {
            core.setFailed(`Build failed with exit code ${exitCode}`);
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
async function runLocalBuild(buildParameters, baseImage, workspace, actionFolder, plugin) {
    await plugin?.beforeLocalBuild(workspace);
    await platform_setup_1.default.setup(buildParameters, actionFolder);
    const exitCode = process.platform === 'darwin'
        ? await mac_builder_1.default.run(actionFolder)
        : await model_1.Docker.run(baseImage.toString(), {
            workspace,
            actionFolder,
            ...buildParameters,
        });
    await plugin?.afterLocalBuild(workspace, exitCode);
    return exitCode;
}
// Only auto-run when executed directly (subprocess/script invocation), not
// when imported as a library by a thin-wrapper action repo (which calls
// runMain() explicitly) — see game-ci/roadmap#11 workstream 2.
if (require.main === module) {
    runMain();
}
