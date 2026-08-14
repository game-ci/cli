"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const image_environment_factory_1 = __importDefault(require("./image-environment-factory"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const exec_1 = require("@actions/exec");
class Docker {
    static async run(image, parameters, silent = false, overrideCommands = '', additionalVariables = [], options = {}, entrypointBash = false) {
        let runCommand = '';
        switch (process.platform) {
            case 'linux':
                runCommand = this.getLinuxCommand(image, parameters, overrideCommands, additionalVariables, entrypointBash);
                break;
            case 'win32':
                runCommand = this.getWindowsCommand(image, parameters);
                break;
            default:
                throw new Error(`Operation system, ${process.platform}, is not supported yet.`);
        }
        options.silent = silent;
        options.ignoreReturnCode = true;
        return await (0, exec_1.exec)(runCommand, undefined, options);
    }
    static getLinuxCommand(image, parameters, overrideCommands = '', additionalVariables = [], entrypointBash = false) {
        const { workspace, actionFolder, useHostNetwork, runnerTempPath, sshAgent, sshPublicKeysDirectoryPath, gitPrivateToken, dockerWorkspacePath, dockerCpuLimit, dockerMemoryLimit, } = parameters;
        const githubHome = node_path_1.default.join(runnerTempPath, '_github_home');
        if (!(0, node_fs_1.existsSync)(githubHome))
            (0, node_fs_1.mkdirSync)(githubHome);
        const githubWorkflow = node_path_1.default.join(runnerTempPath, '_github_workflow');
        if (!(0, node_fs_1.existsSync)(githubWorkflow))
            (0, node_fs_1.mkdirSync)(githubWorkflow);
        // Alpine-based images (alpine, rclone/rclone, etc.) don't have /bin/bash, only /bin/sh
        const isAlpineBasedImage = image === 'alpine' || image.startsWith('rclone/');
        const commandPrefix = isAlpineBasedImage ? `/bin/sh` : `/bin/bash`;
        return `docker run \
            --workdir ${dockerWorkspacePath} \
            --rm \
            ${image_environment_factory_1.default.getEnvVarString(parameters, additionalVariables)} \
            --env GITHUB_WORKSPACE=${dockerWorkspacePath} \
            --env GIT_CONFIG_EXTENSIONS \
            ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
            ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
            --volume "${githubHome}":"/root:z" \
            --volume "${githubWorkflow}":"/github/workflow:z" \
            --volume "${workspace}":"${dockerWorkspacePath}:z" \
            --volume "${actionFolder}/default-build-script:/UnityBuilderAction:z" \
            --volume "${actionFolder}/platforms/ubuntu/steps:/steps:z" \
            --volume "${actionFolder}/platforms/ubuntu/entrypoint.sh:/entrypoint.sh:z" \
            --volume "${actionFolder}/unity-config:/usr/share/unity3d/config/:z" \
            --volume "${actionFolder}/BlankProject":"/BlankProject:z" \
            --cpus=${dockerCpuLimit} \
            --memory=${dockerMemoryLimit} \
            ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
            ${sshAgent && !sshPublicKeysDirectoryPath
            ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro'
            : ''} \
            ${sshPublicKeysDirectoryPath ? `--volume ${sshPublicKeysDirectoryPath}:/root/.ssh:ro` : ''} \
            ${useHostNetwork ? '--net=host' : ''} \
            ${entrypointBash ? `--entrypoint ${commandPrefix}` : ``} \
            ${image} \
            ${entrypointBash ? `-c` : `${commandPrefix} -c`} \
            "${overrideCommands !== '' ? overrideCommands : `/entrypoint.sh`}"`;
    }
    static getWindowsCommand(image, parameters) {
        const { workspace, actionFolder, runnerTempPath, gitPrivateToken, dockerWorkspacePath, dockerCpuLimit, dockerMemoryLimit, dockerIsolationMode, } = parameters;
        const githubHome = node_path_1.default.join(runnerTempPath, '_github_home');
        if (!(0, node_fs_1.existsSync)(githubHome))
            (0, node_fs_1.mkdirSync)(githubHome);
        return `docker run \
            --workdir c:${dockerWorkspacePath} \
            --rm \
            ${image_environment_factory_1.default.getEnvVarString(parameters)} \
            --env BEE_CACHE_DIRECTORY=c:${dockerWorkspacePath}/Library/bee_cache \
            --env GITHUB_WORKSPACE=c:${dockerWorkspacePath} \
            ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
            --volume "${workspace}":"c:${dockerWorkspacePath}" \
            --volume "${githubHome}":"C:/githubhome" \
            --volume "c:/regkeys":"c:/regkeys" \
            --volume "C:/Program Files/Microsoft Visual Studio":"C:/Program Files/Microsoft Visual Studio" \
            --volume "C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \
            --volume "C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \
            --volume "C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" \
            --volume "${actionFolder}/default-build-script":"c:/UnityBuilderAction" \
            --volume "${actionFolder}/platforms/windows":"c:/steps" \
            --volume "${actionFolder}/unity-config":"C:/ProgramData/Unity/config" \
            --volume "${actionFolder}/BlankProject":"c:/BlankProject" \
            --cpus=${dockerCpuLimit} \
            --memory=${dockerMemoryLimit} \
            --isolation=${dockerIsolationMode} \
            ${image} \
            powershell c:/steps/entrypoint.ps1`;
    }
}
exports.default = Docker;
