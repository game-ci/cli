import ImageEnvironmentFactory from './image-environment-factory';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ExecOptions, exec, getExecOutput } from '@actions/exec';
import { DockerParameters, StringKeyValuePair } from './shared-types';

class Docker {
  // Docker Desktop for Windows can run either Windows or Linux containers, and
  // a Windows host with Docker running in Linux-containers mode still needs
  // Linux-style image tags, workdir paths, volume mounts, and entrypoint - the
  // container runtime is Linux regardless of the host OS. `docker version
  // --format '{{.Server.Os}}'` reports what the daemon is actually running,
  // which is the correct signal here, not `process.platform` (see game-ci
  // Discord report: Windows host + Linux containers selected the
  // windows-tagged image and a `c:`-prefixed workdir, which Docker then
  // rejected as an invalid path for a Linux container).
  static async detectDaemonOs(): Promise<string | undefined> {
    try {
      const result = await getExecOutput('docker', ['version', '--format', '{{.Server.Os}}'], {
        silent: true,
        ignoreReturnCode: true,
      });

      const daemonOs = result.stdout.trim().toLowerCase();

      return daemonOs === 'windows' || daemonOs === 'linux' ? daemonOs : undefined;
    } catch {
      return undefined;
    }
  }

  static async resolveBuildPlatform(containerOs: string): Promise<string> {
    if (containerOs === 'linux') return 'linux';
    if (containerOs === 'windows') return 'win32';

    // 'auto' (default): trust the Docker daemon's actual OS over the host OS.
    // Falls back to the host OS when Docker isn't reachable yet (e.g. tests,
    // or environments where `docker version` itself is what's being diagnosed).
    const daemonOs = await Docker.detectDaemonOs();
    if (daemonOs === 'windows') return 'win32';
    if (daemonOs === 'linux') return 'linux';

    return process.platform;
  }

  /**
   * `docker run` pulls an uncached image implicitly, but that folds the pull
   * time into the same session as Unity's license activation/hold/return
   * inside the container - and these images are huge (7-8GB+ for Windows
   * tags). A partial cache miss can take 15+ minutes to pull, which is long
   * enough for Unity's own ephemeral ULF license session to fail to return
   * cleanly once the container finally gets to run - a real failure, but one
   * caused by pull time eating into the license window, not by anything
   * about the build itself. Pulling explicitly first, before that window
   * opens, avoids the whole class of failure. A pull failure here is a real,
   * non-retryable-by-us problem (bad tag, registry down) and is left to fail
   * with Docker's own error rather than swallowed.
   */
  static async pull(image: string): Promise<void> {
    await exec('docker', ['pull', image]);
  }

  static async run(
    image: string,
    parameters: DockerParameters,
    silent: boolean = false,
    overrideCommands: string = '',
    additionalVariables: StringKeyValuePair[] = [],
    options: ExecOptions = {},
    entrypointBash: boolean = false,
  ): Promise<number> {
    // parameters.buildPlatform reflects the container runtime the CLI decided
    // to target (see BuildParameters.create) - trust it over process.platform
    // so a Windows host running Docker Desktop in Linux-containers mode still
    // gets Linux image tags, workdir paths, and entrypoint.
    const runPlatform = parameters.buildPlatform ?? process.platform;

    await Docker.pull(image);

    let runCommand = '';
    switch (runPlatform) {
      case 'linux':
        runCommand = this.getLinuxCommand(
          image,
          parameters,
          overrideCommands,
          additionalVariables,
          entrypointBash,
        );
        break;
      case 'win32':
        runCommand = this.getWindowsCommand(image, parameters);
        break;
      default:
        throw new Error(`Operation system, ${runPlatform}, is not supported yet.`);
    }

    options.silent = silent;
    options.ignoreReturnCode = true;

    return await exec(runCommand, undefined, options);
  }

  static getLinuxCommand(
    image: string,
    parameters: DockerParameters,
    overrideCommands: string = '',
    additionalVariables: StringKeyValuePair[] = [],
    entrypointBash: boolean = false,
  ): string {
    const {
      workspace,
      actionFolder,
      useHostNetwork,
      runnerTempPath,
      sshAgent,
      sshPublicKeysDirectoryPath,
      gitPrivateToken,
      dockerWorkspacePath,
      dockerCpuLimit,
      dockerMemoryLimit,
    } = parameters;

    const githubHome = path.join(runnerTempPath, '_github_home');
    if (!existsSync(githubHome)) mkdirSync(githubHome);
    const githubWorkflow = path.join(runnerTempPath, '_github_workflow');
    if (!existsSync(githubWorkflow)) mkdirSync(githubWorkflow);

    // Alpine-based images (alpine, rclone/rclone, etc.) don't have /bin/bash, only /bin/sh
    const isAlpineBasedImage = image === 'alpine' || image.startsWith('rclone/');
    const commandPrefix = isAlpineBasedImage ? `/bin/sh` : `/bin/bash`;

    return `docker run \
            --workdir ${dockerWorkspacePath} \
            --rm \
            ${ImageEnvironmentFactory.getEnvVarString(parameters, additionalVariables)} \
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
            ${
              sshAgent && !sshPublicKeysDirectoryPath
                ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro'
                : ''
            } \
            ${sshPublicKeysDirectoryPath ? `--volume ${sshPublicKeysDirectoryPath}:/root/.ssh:ro` : ''} \
            ${useHostNetwork ? '--net=host' : ''} \
            ${entrypointBash ? `--entrypoint ${commandPrefix}` : ``} \
            ${image} \
            ${entrypointBash ? `-c` : `${commandPrefix} -c`} \
            "${overrideCommands !== '' ? overrideCommands : `/entrypoint.sh`}"`;
  }

  static getWindowsCommand(image: string, parameters: DockerParameters): string {
    const {
      workspace,
      actionFolder,
      runnerTempPath,
      gitPrivateToken,
      dockerWorkspacePath,
      dockerCpuLimit,
      dockerMemoryLimit,
      dockerIsolationMode,
    } = parameters;

    const githubHome = path.join(runnerTempPath, '_github_home');
    if (!existsSync(githubHome)) mkdirSync(githubHome);

    return `docker run \
            --workdir c:${dockerWorkspacePath} \
            --rm \
            ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
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

export default Docker;
