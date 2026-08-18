import type { Options } from '../dependencies.ts';
import { System } from './system/system.ts';
import { ImageEnvironmentFactory } from './image-environment-factory.ts';
import { UnityEnvironment } from '../logic/unity/environment.ts';
import { path, fsSync as fs } from '../dependencies.ts';

/**
 * Runs the same activate/test/build step scripts Docker.run mounts into a
 * container, directly on this machine instead - for self-hosted runners
 * with Unity already installed. Mirrors MacBuilder (macOS never had a
 * Docker path to begin with), generalized to Linux/Windows so `--local`
 * (see DockerTestOptions) works cross-platform. Mirrors orchestrator's own
 * `local` provider, which runs the equivalent build/test commands directly
 * on the host rather than dispatching to a container/cloud provider.
 *
 * Deliberately does NOT invoke entrypoint.sh: that script does
 * container-only setup (randomizing /etc/machine-id, creating a matching
 * host user via useradd/groupadd) that would mutate a real, persistent
 * self-hosted machine rather than a throwaway container - genuinely
 * dangerous outside Docker. Goes straight to runsteps.sh (activate -> test
 * or build -> return license), the same core steps.sh scripts already use.
 */
class HostRunner {
  private static buildEnv(options: Options): Record<string, string> {
    const { currentWorkDir, cliDistPath, hostPlatform } = options;
    const extraVariables = options.engine === 'unity' ? UnityEnvironment.getVariables(options) : [];
    const variables = ImageEnvironmentFactory.getEnvironmentVariables(options, extraVariables);
    const env: Record<string, string> = {};
    for (const { name, value } of variables) {
      if (value === '' || value === undefined) continue;
      env[name] = value.toString();
    }
    if (currentWorkDir) env.GITHUB_WORKSPACE = currentWorkDir;

    const stepsDir = HostRunner.stepsDir(hostPlatform, cliDistPath);
    env.STEPS_DIR = stepsDir;
    env.TEST_RUNNER_ACTION_DIR = path.join(cliDistPath, 'test-standalone-scripts');

    // entrypoint.sh normally creates this before sourcing runsteps.sh -
    // replicated here since HostRunner bypasses entrypoint.sh entirely.
    const activateLicensePath = path.join(currentWorkDir || process.cwd(), '_activate-license~');
    if (!fs.existsSync(activateLicensePath)) fs.mkdirSync(activateLicensePath, { recursive: true });
    env.ACTIVATE_LICENSE_PATH = activateLicensePath;

    return env;
  }

  private static stepsDir(hostPlatform: string, cliDistPath: string): string {
    switch (hostPlatform) {
      case 'win32':
        return path.join(cliDistPath, 'platforms', 'windows');
      case 'linux':
      default:
        return path.join(cliDistPath, 'platforms', 'ubuntu', 'steps');
    }
  }

  public static async run(options: Options, silent = false) {
    const { cliDistPath, hostPlatform } = options;

    if (hostPlatform !== 'linux') {
      throw new Error(
        `--local is currently only supported when running on Linux (got hostPlatform=${hostPlatform}). ` +
          'macOS already runs natively via MacBuilder without needing --local; Windows host-mode support is tracked separately.',
      );
    }

    log.warning('running the process directly on this host (no Docker)');

    const runstepsPath = path.join(cliDistPath, 'platforms', 'ubuntu', 'steps', 'runsteps.sh');
    await System.run(`bash "${runstepsPath}"`, undefined, {
      silent,
      env: HostRunner.buildEnv(options),
    });
  }
}

export { HostRunner };
