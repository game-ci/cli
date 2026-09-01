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
const image_environment_factory_1 = __importDefault(require("./image-environment-factory"));
const fs_1 = require("fs");
const licensing_server_setup_1 = __importDefault(require("./licensing-server-setup"));
const exec_1 = require("@actions/exec");
const core = __importStar(require("@actions/core"));
const path_1 = __importDefault(require("path"));
/**
 * Build a path for a docker --cidfile parameter. Docker will store the the created container.
 * This path is stable for the whole execution of the action, so it can be executed with the same parameters
 * multiple times and get the same result.
 */
const containerIdFilePath = (parameters) => {
    const { runnerTemporaryPath, githubAction } = parameters;
    return path_1.default.join(runnerTemporaryPath, `container_${githubAction}`);
};
/**
 * 1025m was previously hardcoded here: Unity 6.6+ editors request 1GiB of
 * shared memory and fail against Docker's 64m default
 * (game-ci/unity-test-runner#307). It is now the default in Input, so the
 * effective behaviour is unchanged, but users can raise or disable it.
 * '0'/'none' omits the flag so Docker's own default applies.
 */
function shmSizeFlag(dockerShmSize) {
    const value = String(dockerShmSize ?? '').trim();
    if (value === '' || value === '0' || value.toLowerCase() === 'none')
        return '';
    return `--shm-size=${value}`;
}
const Docker = {
    /**
     *  Remove a possible leftover container created by `Docker.run`.
     */
    async ensureContainerRemoval(parameters) {
        const cidfile = containerIdFilePath(parameters);
        if (!(0, fs_1.existsSync)(cidfile)) {
            return;
        }
        const container = (0, fs_1.readFileSync)(cidfile, 'ascii').trim();
        try {
            if (container !== '') {
                await (0, exec_1.exec)(`docker`, ['rm', '--force', '--volumes', container], { silent: true });
            }
        }
        finally {
            // Always drop the cidfile, even if `docker rm` failed or there was nothing to
            // remove (a docker run that failed before writing a container ID still creates
            // the file - `--cidfile` refuses to run again while a stale file is present).
            (0, fs_1.rmSync)(cidfile);
        }
    },
    /**
     * `docker run` pulls an uncached image implicitly, but that folds the pull
     * time into the same session as Unity's license activation/hold/return
     * inside the container - and these images are huge (7-8GB+ for Windows
     * tags). A partial cache miss can take 15+ minutes to pull, and observed
     * in practice (unity-test-runner#310's CI) that's long enough for Unity's
     * own ephemeral ULF license session to fail to return cleanly
     * ("Serial number unavailable for ULF return") once the container
     * finally gets to run - a real failure, but one caused by pull time
     * eating into the license window, not by anything about the test itself.
     * Pulling explicitly first, before that window opens, avoids the whole
     * class of failure. A pull failure here is a real, non-retryable-by-us
     * problem (bad tag, registry down) and is left to fail with Docker's own
     * error rather than swallowed.
     */
    async pull(image) {
        await (0, exec_1.exec)('docker', ['pull', String(image)]);
    },
    async run(image, parameters, silent = false) {
        let runCommand = '';
        if (parameters.unityLicensingServer !== '') {
            licensing_server_setup_1.default.Setup(parameters.unityLicensingServer, parameters.actionFolder);
        }
        await this.pull(image);
        switch (process.platform) {
            case 'linux':
                runCommand = this.getLinuxCommand(image, parameters);
                break;
            case 'win32':
                runCommand = this.getWindowsCommand(image, parameters);
                break;
            default:
                throw new Error(`Operation system, ${process.platform}, is not supported yet.`);
        }
        // With a githubToken set, the container runs with USE_EXIT_CODE=false (see
        // getLinuxCommand/getWindowsCommand) - test results are reported through GitHub
        // Checks, not the process exit code, so in that mode a nonzero exit here can only
        // mean the docker/container launch itself failed (e.g. the intermittent Windows
        // runner "docker.exe failed with exit code 1" flake - unity-test-runner#314),
        // never a real test failure. Retrying is only safe in that mode: without a token,
        // USE_EXIT_CODE=true and a nonzero exit IS how test failures are signaled, so a
        // retry there would silently re-run (and could mask) a real failure.
        const launchFailuresAreRetryable = Boolean(parameters.githubToken);
        const maxAttempts = launchFailuresAreRetryable ? 3 : 1;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await (0, exec_1.exec)(runCommand, undefined, { silent });
                return;
            }
            catch (error) {
                if (attempt === maxAttempts)
                    throw error;
                core.warning(`Docker run failed (attempt ${attempt}/${maxAttempts}): ${error instanceof Error ? error.message : String(error)}. Retrying...`);
                try {
                    await this.ensureContainerRemoval(parameters);
                }
                catch (cleanupError) {
                    core.warning(`Cleanup before retry failed, continuing anyway: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    },
    getLinuxCommand(image, parameters) {
        const { actionFolder, workspace, testMode, useHostNetwork, sshAgent, sshPublicKeysDirectoryPath, githubToken, runnerTemporaryPath, dockerCpuLimit, dockerMemoryLimit, dockerShmSize, } = parameters;
        const githubHome = path_1.default.join(runnerTemporaryPath, '_github_home');
        if (!(0, fs_1.existsSync)(githubHome))
            (0, fs_1.mkdirSync)(githubHome);
        const githubWorkflow = path_1.default.join(runnerTemporaryPath, '_github_workflow');
        if (!(0, fs_1.existsSync)(githubWorkflow))
            (0, fs_1.mkdirSync)(githubWorkflow);
        const cidfile = containerIdFilePath(parameters);
        const testPlatforms = (testMode === 'all' ? ['playmode', 'editmode', 'COMBINE_RESULTS'] : [testMode]).join(';');
        return `docker run \
            ${shmSizeFlag(dockerShmSize)} \
            --workdir /github/workspace \
            --cidfile "${cidfile}" \
            --rm \
            ${image_environment_factory_1.default.getEnvVarString(parameters)} \
            --env GIT_CONFIG_EXTENSIONS \
            --env TEST_PLATFORMS="${testPlatforms}" \
            --env GITHUB_WORKSPACE="/github/workspace" \
            ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
            --volume "${githubHome}:/root:z" \
            --volume "${githubWorkflow}:/github/workflow:z" \
            --volume "${workspace}:/github/workspace:z" \
            --volume "${actionFolder}/test-standalone-scripts:/UnityStandaloneScripts:z" \
            --volume "${actionFolder}/platforms/ubuntu:/steps:z" \
            --volume "${actionFolder}/unity-config:/usr/share/unity3d/config/:z" \
            --volume "${actionFolder}/BlankProject":"/BlankProject:z" \
            --cpus=${dockerCpuLimit} \
            --memory=${dockerMemoryLimit} \
            ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
            ${sshAgent && !sshPublicKeysDirectoryPath
            ? `--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro`
            : ''} \
            ${sshPublicKeysDirectoryPath
            ? `--volume ${sshPublicKeysDirectoryPath}:/root/.ssh:ro`
            : ''} \
            ${useHostNetwork ? '--net=host' : ''} \
            ${githubToken ? '--env USE_EXIT_CODE=false' : '--env USE_EXIT_CODE=true'} \
            ${image} \
            /bin/bash -c "/steps/entrypoint.sh`;
    },
    getWindowsCommand(image, parameters) {
        const { actionFolder, workspace, testMode, useHostNetwork, sshAgent, githubToken, runnerTemporaryPath, dockerCpuLimit, dockerMemoryLimit, dockerShmSize, dockerIsolationMode, } = parameters;
        const githubHome = path_1.default.join(runnerTemporaryPath, '_github_home');
        if (!(0, fs_1.existsSync)(githubHome))
            (0, fs_1.mkdirSync)(githubHome);
        const cidfile = containerIdFilePath(parameters);
        const githubWorkflow = path_1.default.join(runnerTemporaryPath, '_github_workflow');
        if (!(0, fs_1.existsSync)(githubWorkflow))
            (0, fs_1.mkdirSync)(githubWorkflow);
        const testPlatforms = (testMode === 'all' ? ['playmode', 'editmode', 'COMBINE_RESULTS'] : [testMode]).join(';');
        return `docker run \
                ${shmSizeFlag(dockerShmSize)} \
                --workdir c:/github/workspace \
                --cidfile "${cidfile}" \
                --rm \
                ${image_environment_factory_1.default.getEnvVarString(parameters)} \
                --env TEST_PLATFORMS="${testPlatforms}" \
                --env GITHUB_WORKSPACE="c:/github/workspace" \
                ${sshAgent ? '--env SSH_AUTH_SOCK=c:/ssh-agent' : ''} \
                --volume "${actionFolder}/test-standalone-scripts":"c:/UnityStandaloneScripts" \
                --volume "${githubHome}":"c:/root" \
                --volume "${githubWorkflow}":"c:/github/workflow" \
                --volume "${workspace}":"c:/github/workspace" \
                --volume "${actionFolder}/platforms/windows":"c:/steps" \
                --volume "${actionFolder}/BlankProject":"c:/BlankProject" \
                ${sshAgent ? `--volume ${sshAgent}:c:/ssh-agent` : ''} \
                ${sshAgent
            ? `--volume c:/Users/Administrator/.ssh/known_hosts:c:/root/.ssh/known_hosts`
            : ''} \
                --cpus=${dockerCpuLimit} \
                --memory=${dockerMemoryLimit} \
                --isolation=${dockerIsolationMode} \
                ${useHostNetwork ? '--net=host' : ''} \
                ${githubToken ? '--env USE_EXIT_CODE=false' : '--env USE_EXIT_CODE=true'} \
                ${image} \
                powershell c:/steps/entrypoint.ps1`;
    },
};
exports.default = Docker;
