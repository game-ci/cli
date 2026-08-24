import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import { UnityCliAdapter } from '../../model/unity-cli-adapter.ts';
import { UnityTestOptions } from '../../command-options/unity-test-options.ts';
import { DockerTestOptions } from '../../command-options/docker-test-options.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';
import { UnityOptions } from '../../command-options/unity-options.ts';
import { Docker, RunnerImageTag } from '../../model/index.ts';
import { HostRunner } from '../../model/host-runner.ts';
import { PlatformSetup } from '../../logic/unity/platform-setup/index.ts';
import type { YargsInstance, Options } from '../../dependencies.ts';

/**
 * Real bug found via a live CI run: defaulting to NoTarget (RunnerImageTag's
 * 'base' module) seemed like the obvious no-target-platform-being-built
 * choice, but 'base' apparently lacks whatever's needed to actually compile
 * and run test assemblies - `-runTests` exited instantly with no log output
 * at all against it. unity-test-runner's own original ImageTag defaulted to
 * this host's native Standalone target instead (see its
 * getImagePlatformType) - StandaloneLinux64 resolves to the linux-il2cpp
 * module for Unity 2020+, which does have what's needed. Matching that
 * here, rather than NoTarget.
 */
function defaultTestTargetPlatform(hostPlatform: string = process.platform): string {
  switch (hostPlatform) {
    case 'win32':
      return 'StandaloneWindows';
    case 'linux':
    default:
      return 'StandaloneLinux64';
  }
}

/**
 * `game-ci test` — two independent ways to run Unity tests, chosen via
 * --docker:
 *
 *  - Default (--docker not set): wraps Unity's own official, still
 *    experimental `test` CLI command (docs.unity.com/en-us/unity-cli).
 *    Requires the `unity` binary on PATH. See game-ci/roadmap#11
 *    workstream 3 and game-ci/cli#58.
 *
 *  - --docker: the classic Docker/Hub-image-driven batchmode test flow
 *    (-runTests) unity-test-runner's action uses today - editmode/playmode/
 *    standalone/package-mode testing, coverage, artifact collection. Add
 *    --local to run the same flow directly on this machine instead of in a
 *    container, for self-hosted runners with Unity already installed (see
 *    HostRunner) - mirrors orchestrator's own local (host) provider vs its
 *    docker provider.
 *
 *    Supported on Linux and Windows containers alike; macOS has no Unity
 *    Editor Docker images to run in, so it is rejected (use --local, or the
 *    default `unity test` CLI path, there).
 */
export class UnityTestCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    if (options.docker) {
      return this.executeDocker(options);
    }

    return this.executeUnityCli(options);
  }

  private async executeUnityCli(options: Options): Promise<boolean> {
    const extraArgs = String(options.unityCliArgs || '')
      .split(' ')
      .map((arg) => arg.trim())
      .filter(Boolean);

    const available = await UnityCliAdapter.isAvailable();
    if (!available) {
      throw new Error(
        "test: requires Unity's official `unity` CLI binary on PATH " +
          '(https://docs.unity.com/en-us/unity-cli). Not found in this environment, or pass --docker ' +
          'to run the classic Docker/Hub-image-driven test flow instead.',
      );
    }

    try {
      const result = await UnityCliAdapter.test(extraArgs);
      log.info(result.output);

      return result.success;
    } catch (error: any) {
      // UnityCliAdapter.test rejects (rather than resolving with
      // success: false) whenever the underlying process writes to stderr,
      // which is common even for otherwise-successful Unity CLI invocations.
      throw new Error(`test: 'unity test' failed: ${error.message}`);
    }
  }

  private async executeDocker(options: Options): Promise<boolean> {
    const { hostPlatform, local } = options;

    if (local) {
      // HostRunner itself now supports both Linux and Windows natively
      // (dist/platforms/{ubuntu,windows}/steps/{runsteps,test}.{sh,ps1}) -
      // this no longer needs a platform gate the way the container path
      // below still does.
      await HostRunner.run({ ...options, runTests: true });
      return true;
    }

    // Docker (container) test mode is wired up for Linux containers
    // (dist/platforms/ubuntu/steps/test.sh, via runsteps.sh's RUN_TESTS
    // branch) and for Windows containers (dist/platforms/windows/
    // entrypoint.ps1's own RUN_TESTS branch, which reuses steps/test.ps1 -
    // container-safe because its resolve_unity_path.ps1 honours the
    // image-baked $Env:UNITY_PATH).
    //
    // macOS is still rejected, and always will be for this flow: there are
    // no Unity Editor Docker images for macOS at all, so there is nothing
    // to run the container-side scripts in. Checked before
    // PlatformSetup.setup runs, so this fails fast instead of after
    // prompting for credentials.
    if (hostPlatform === 'darwin') {
      throw new Error(
        `--docker's classic batchmode test flow is not supported on macOS hosts ` +
          `(got hostPlatform=${hostPlatform}). No Unity Editor Docker images exist for macOS - omit ` +
          '--docker to use the native `unity test` CLI instead, or add --local to run the same batchmode ' +
          'flow directly against a locally installed Unity.',
      );
    }

    const testOptions = {
      ...options,
      targetPlatform: options.targetPlatform || defaultTestTargetPlatform(hostPlatform),
    };

    const image = new RunnerImageTag(testOptions);
    if (log.isVerbose) log.debug('Using image:', image);

    await PlatformSetup.setup(testOptions);

    await log.group('Unity test', async () => {
      await Docker.run(image.toString(), { ...testOptions, runTests: true });
    });

    return true;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await UnityOptions.configure(yargs);
    // UnityOptions defaults targetPlatform to StandaloneWindows64
    // unconditionally (a build concern) - override to this host's own
    // native target, matching unity-test-runner's original default (see
    // defaultTestTargetPlatform's comment for why NoTarget doesn't work
    // here). A caller can still pass --targetPlatform explicitly (e.g. for
    // --testPlatforms=standalone scenarios targeting a different platform).
    yargs.default('targetPlatform', defaultTestTargetPlatform());
    await UnityTestOptions.configure(yargs);
    await DockerTestOptions.configure(yargs);
  }
}
