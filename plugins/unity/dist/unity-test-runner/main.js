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
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const core = __importStar(require("@actions/core"));
const model_1 = require("./model");
async function run() {
    try {
        model_1.Action.checkCompatibility();
        const { workspace, actionFolder } = model_1.Action;
        const { editorVersion, customImage, projectPath, customParameters, testMode, coverageEnabled, coverageOptions, artifactsPath, useHostNetwork, sshAgent, sshPublicKeysDirectoryPath, gitPrivateToken, githubToken, checkName, packageMode, packageName, scopedRegistryUrl, registryScopes, chownFilesTo, dockerCpuLimit, dockerMemoryLimit, dockerIsolationMode, unityLicensingServer, runAsHostUser, containerRegistryRepository, containerRegistryImageVersion, unitySerial, } = model_1.Input.getFromUser();
        const baseImage = new model_1.ImageTag({
            editorVersion,
            customImage,
            containerRegistryRepository,
            containerRegistryImageVersion,
        });
        const runnerContext = model_1.Action.runnerContext();
        try {
            await model_1.Docker.run(baseImage, {
                actionFolder,
                editorVersion,
                workspace,
                projectPath,
                customParameters,
                testMode,
                coverageEnabled,
                coverageOptions,
                artifactsPath,
                useHostNetwork,
                sshAgent,
                sshPublicKeysDirectoryPath,
                packageMode,
                packageName,
                scopedRegistryUrl,
                registryScopes,
                gitPrivateToken,
                githubToken,
                chownFilesTo,
                dockerCpuLimit,
                dockerMemoryLimit,
                dockerIsolationMode,
                unityLicensingServer,
                runAsHostUser,
                unitySerial,
                ...runnerContext,
            });
        }
        finally {
            await model_1.Output.setArtifactsPath(artifactsPath);
            await model_1.Output.setCoveragePath('CodeCoverage');
        }
        if (githubToken) {
            const failedTestCount = await model_1.ResultsCheck.createCheck(artifactsPath, githubToken, checkName);
            if (failedTestCount >= 1) {
                core.setFailed(`Test(s) Failed! Check '${checkName}' for details.`);
            }
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
