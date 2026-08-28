import ImageEnvironmentFactory from './image-environment-factory';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import LicensingServerSetup from './licensing-server-setup';
import type { RunnerContext } from './action';
import { exec } from '@actions/exec';
import * as core from '@actions/core';
import path from 'path';

/**
 * Build a path for a docker --cidfile parameter. Docker will store the the created container.
 * This path is stable for the whole execution of the action, so it can be executed with the same parameters
 * multiple times and get the same result.
 */
const containerIdFilePath = (parameters) => {
  const { runnerTemporaryPath, githubAction } = parameters;

  return path.join(runnerTemporaryPath, `container_${githubAction}`);
};

const Docker = {
  /**
   *  Remove a possible leftover container created by `Docker.run`.
   */
  async ensureContainerRemoval(parameters: RunnerContext) {
    const cidfile = containerIdFilePath(parameters);
    if (!existsSync(cidfile)) {
      return;
    }
    const container = readFileSync(cidfile, 'ascii').trim();
    try {
      if (container !== '') {
        await exec(`docker`, ['rm', '--force', '--volumes', container], { silent: true });
      }
    } finally {
      // Always drop the cidfile, even if `docker rm` failed or there was nothing to
      // remove (a docker run that failed before writing a container ID still creates
      // the file - `--cidfile` refuses to run again while a stale file is present).
      rmSync(cidfile);
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
    await exec('docker', ['pull', String(image)]);
  },

  async run(image, parameters, silent = false) {
    let runCommand = '';

    if (parameters.unityLicensingServer !== '') {
      LicensingServerSetup.Setup(parameters.unityLicensingServer, parameters.actionFolder);
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
        await exec(runCommand, undefined, { silent });
        return;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        core.warning(
          `Docker run failed (attempt ${attempt}/${maxAttempts}): ${
            error instanceof Error ? error.message : String(error)
          }. Retrying...`,
        );
        try {
          await this.ensureContainerRemoval(parameters);
        } catch (cleanupError) {
          core.warning(
            `Cleanup before retry failed, continuing anyway: ${
              cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
            }`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  },

  getLinuxCommand(image, parameters): string {
    const {
      actionFolder,
      workspace,
      testMode,
      useHostNetwork,
      sshAgent,
      sshPublicKeysDirectoryPath,
      githubToken,
      runnerTemporaryPath,
      dockerCpuLimit,
      dockerMemoryLimit,
    } = parameters;

    const githubHome = path.join(runnerTemporaryPath, '_github_home');
    if (!existsSync(githubHome)) mkdirSync(githubHome);
    const githubWorkflow = path.join(runnerTemporaryPath, '_github_workflow');
    if (!existsSync(githubWorkflow)) mkdirSync(githubWorkflow);
    const cidfile = containerIdFilePath(parameters);
    const testPlatforms = (
      testMode === 'all' ? ['playmode', 'editmode', 'COMBINE_RESULTS'] : [testMode]
    ).join(';');

    return `docker run \
            --shm-size=1025m \
            --workdir /github/workspace \
            --cidfile "${cidfile}" \
            --rm \
            ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
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
            ${
              sshAgent && !sshPublicKeysDirectoryPath
                ? `--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro`
                : ''
            } \
            ${
              sshPublicKeysDirectoryPath
                ? `--volume ${sshPublicKeysDirectoryPath}:/root/.ssh:ro`
                : ''
            } \
            ${useHostNetwork ? '--net=host' : ''} \
            ${githubToken ? '--env USE_EXIT_CODE=false' : '--env USE_EXIT_CODE=true'} \
            ${image} \
            /bin/bash -c "/steps/entrypoint.sh`;
  },

  getWindowsCommand(image, parameters): string {
    const {
      actionFolder,
      workspace,
      testMode,
      useHostNetwork,
      sshAgent,
      githubToken,
      runnerTemporaryPath,
      dockerCpuLimit,
      dockerMemoryLimit,
      dockerIsolationMode,
    } = parameters;

    const githubHome = path.join(runnerTemporaryPath, '_github_home');
    if (!existsSync(githubHome)) mkdirSync(githubHome);
    const cidfile = containerIdFilePath(parameters);
    const githubWorkflow = path.join(runnerTemporaryPath, '_github_workflow');
    if (!existsSync(githubWorkflow)) mkdirSync(githubWorkflow);
    const testPlatforms = (
      testMode === 'all' ? ['playmode', 'editmode', 'COMBINE_RESULTS'] : [testMode]
    ).join(';');

    return `docker run \
                --shm-size=1025m \
                --workdir c:/github/workspace \
                --cidfile "${cidfile}" \
                --rm \
                ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
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
                ${
                  sshAgent
                    ? `--volume c:/Users/Administrator/.ssh/known_hosts:c:/root/.ssh/known_hosts`
                    : ''
                } \
                --cpus=${dockerCpuLimit} \
                --memory=${dockerMemoryLimit} \
                --isolation=${dockerIsolationMode} \
                ${useHostNetwork ? '--net=host' : ''} \
                ${githubToken ? '--env USE_EXIT_CODE=false' : '--env USE_EXIT_CODE=true'} \
                ${image} \
                powershell c:/steps/entrypoint.ps1`;
  },
};

export default Docker;
