"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const image_environment_factory_1 = __importDefault(require("./image-environment-factory"));
const fs_1 = require("fs");
const licensing_server_setup_1 = __importDefault(require("./licensing-server-setup"));
const exec_1 = require("@actions/exec");
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
        await (0, exec_1.exec)(`docker`, ['rm', '--force', '--volumes', container], { silent: true });
        (0, fs_1.rmSync)(cidfile);
    },
    async run(image, parameters, silent = false) {
        let runCommand = '';
        if (parameters.unityLicensingServer !== '') {
            licensing_server_setup_1.default.Setup(parameters.unityLicensingServer, parameters.actionFolder);
        }
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
        await (0, exec_1.exec)(runCommand, undefined, { silent });
    },
    getLinuxCommand(image, parameters) {
        const { actionFolder, workspace, testMode, useHostNetwork, sshAgent, sshPublicKeysDirectoryPath, githubToken, runnerTemporaryPath, dockerCpuLimit, dockerMemoryLimit, } = parameters;
        const githubHome = path_1.default.join(runnerTemporaryPath, '_github_home');
        if (!(0, fs_1.existsSync)(githubHome))
            (0, fs_1.mkdirSync)(githubHome);
        const githubWorkflow = path_1.default.join(runnerTemporaryPath, '_github_workflow');
        if (!(0, fs_1.existsSync)(githubWorkflow))
            (0, fs_1.mkdirSync)(githubWorkflow);
        const cidfile = containerIdFilePath(parameters);
        const testPlatforms = (testMode === 'all' ? ['playmode', 'editmode', 'COMBINE_RESULTS'] : [testMode]).join(';');
        return `docker run \
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
        const { actionFolder, workspace, testMode, useHostNetwork, sshAgent, githubToken, runnerTemporaryPath, dockerCpuLimit, dockerMemoryLimit, dockerIsolationMode, } = parameters;
        const githubHome = path_1.default.join(runnerTemporaryPath, '_github_home');
        if (!(0, fs_1.existsSync)(githubHome))
            (0, fs_1.mkdirSync)(githubHome);
        const cidfile = containerIdFilePath(parameters);
        const githubWorkflow = path_1.default.join(runnerTemporaryPath, '_github_workflow');
        if (!(0, fs_1.existsSync)(githubWorkflow))
            (0, fs_1.mkdirSync)(githubWorkflow);
        const testPlatforms = (testMode === 'all' ? ['playmode', 'editmode', 'COMBINE_RESULTS'] : [testMode]).join(';');
        return `docker run \
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
