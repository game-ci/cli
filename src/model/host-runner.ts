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
 * Deliberately does NOT invoke entrypoint.sh/entrypoint.ps1: those scripts
 * do container-only setup (Linux: randomizing /etc/machine-id, creating a
 * matching host user via useradd/groupadd; Windows: registry imports,
 * registering the container's own Visual Studio installation) that would
 * mutate a real, persistent self-hosted machine rather than a throwaway
 * container - genuinely dangerous outside Docker. Goes straight to
 * runsteps.sh/runsteps.ps1 (activate -> test or build -> return license),
 * the same core step scripts already use.
 *
 * Windows note: dist/platforms/windows/*.ps1 (activate.ps1, build.ps1,
 * entrypoint.ps1, ...) are the *Docker container* scripts for
 * `unityci/editor` Windows images - they assume a baked-in $Env:UNITY_PATH
 * and container-only setup, and have no RUN_TESTS support at all. This
 * class instead uses a separate, genuinely native script set under
 * dist/platforms/windows/steps/ (mirroring dist/platforms/ubuntu/steps/),
 * which resolve Unity's install location dynamically from Unity Hub's
 * default install directory (or $Env:UNITY_PATH if set) rather than
 * assuming a container-baked path.
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
    // Used by the native build scripts' default build-method fallback (no
    // BUILD_METHOD set) to locate dist/default-build-script - mirrors
    // MacBuilder.buildEnv's own ACTION_FOLDER, which mac/steps/build.sh
    // already relies on for the same purpose.
    env.ACTION_FOLDER = cliDistPath;

    const stepsDir = HostRunner.stepsDir(hostPlatform, cliDistPath);
    env.STEPS_DIR = stepsDir;
    env.TEST_RUNNER_ACTION_DIR = path.join(cliDistPath, 'test-standalone-scripts');

    // entrypoint.sh/entrypoint.ps1 normally create this before sourcing
    // runsteps.sh/runsteps.ps1 - replicated here since HostRunner bypasses
    // those entrypoints entirely.
    const activateLicensePath = path.join(currentWorkDir || process.cwd(), '_activate-license~');
    if (!fs.existsSync(activateLicensePath)) fs.mkdirSync(activateLicensePath, { recursive: true });
    env.ACTIVATE_LICENSE_PATH = activateLicensePath;

    return env;
  }

  private static stepsDir(hostPlatform: string, cliDistPath: string): string {
    switch (hostPlatform) {
      case 'win32':
        // Deliberately NOT dist/platforms/windows (the Docker-container
        // script set - see class doc comment) - a sibling steps/ directory
        // with genuinely native scripts, mirroring ubuntu's steps/ layout.
        return path.join(cliDistPath, 'platforms', 'windows', 'steps');
      case 'linux':
      default:
        return path.join(cliDistPath, 'platforms', 'ubuntu', 'steps');
    }
  }

  public static async run(options: Options, silent = false) {
    const { cliDistPath, hostPlatform } = options;

    if (hostPlatform !== 'linux' && hostPlatform !== 'win32') {
      throw new Error(
        `--local is currently only supported when running on Linux or Windows (got hostPlatform=${hostPlatform}). ` +
          'macOS already runs natively via MacBuilder without needing --local.',
      );
    }

    log.warning('running the process directly on this host (no Docker)');

    const env = HostRunner.buildEnv(options);

    if (hostPlatform === 'win32') {
      const runstepsPath = path.join(cliDistPath, 'platforms', 'windows', 'steps', 'runsteps.ps1');
      // Run via a nested `-File` invocation (rather than passing the script
      // path straight to System.run's own `-Command` shell) so PowerShell's
      // native argument handling deals with quoting, and so the script's
      // own `exit $code` calls set that nested process's exit code
      // directly - then explicitly re-propagate it as this command's own
      // exit code, since a plain `-Command` invocation does not otherwise
      // forward a nested process's exit code as its own.
      await System.run(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${runstepsPath}"; exit $LASTEXITCODE`,
        undefined,
        { silent, env },
      );
      return;
    }

    const runstepsPath = path.join(cliDistPath, 'platforms', 'ubuntu', 'steps', 'runsteps.sh');
    await System.run(`bash "${runstepsPath}"`, undefined, {
      silent,
      env,
    });
  }
}

export { HostRunner };
