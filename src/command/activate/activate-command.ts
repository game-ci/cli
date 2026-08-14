import { CommandInterface } from '../command-interface.ts';
import { Docker, RunnerImageTag } from '../../model/index.ts';
import { PlatformSetup } from '../../logic/unity/platform-setup/index.ts';
import { MacBuilder } from '../../model/mac-builder.ts';
import { CommandBase } from '../command-base.ts';
import { UnityOptions } from '../../command-options/unity-options.ts';
import type { YargsInstance, Options } from '../../dependencies.ts';
import { PlatformValidation } from '../../logic/unity/platform-validation/platform-validation.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';
import { UnityTargetPlatform } from '../../model/unity/target-platform/unity-target-platform.ts';

/**
 * Activates (and only activates) a Unity license, leaving it active for a
 * later step to use - it does not build or return the license itself.
 *
 * This is the real, working pilot for the "actions invoke cli" architecture
 * (see game-ci/roadmap#11 workstream 2): unlike `build`/`test`, which the
 * popular action repos still call into as an in-process library today,
 * `game-ci/unity-activate`'s thin wrapper shells out to this command
 * directly, so the exact same code path runs locally and in CI.
 */
export class ActivateCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const { hostPlatform } = options;
    const activateOptions: Options = { ...options, activateOnly: true };

    PlatformValidation.checkCompatibility(activateOptions);

    const image = new RunnerImageTag(activateOptions);
    if (log.isVerbose) log.debug('Using image:', image);

    await PlatformSetup.setup(activateOptions);

    await log.group('Unity activate', async () => {
      if (hostPlatform === 'darwin') {
        await MacBuilder.run(activateOptions);
      } else {
        await Docker.run(image.toString(), activateOptions);
      }
    });

    return true;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await UnityOptions.configure(yargs);
    // UnityOptions.configure() defaults targetPlatform to StandaloneWindows64
    // (a build-oriented default). Activation doesn't build anything - it
    // just needs *an* editor image to run license activation inside - so
    // override the default to NoTarget, which RunnerImageTag maps to the
    // generic image and skips build-target validation entirely (e.g. the
    // "Windows builds need 2019.3+" check, which has nothing to do with
    // activating a license). Callers can still pass --target-platform
    // explicitly if they have a reason to.
    yargs.option('targetPlatform', { default: UnityTargetPlatform.NoTarget });
    // Needed by Docker.run() for the container mount path - normally comes
    // from BuildOptions, but `activate` intentionally doesn't pull in
    // BuildOptions' build-specific flags (buildName, buildMethod, etc.),
    // which don't apply to activation-only.
    yargs.option('dockerWorkspacePath', {
      description: String.dedent`The path to mount the workspace inside the docker container. For windows, leave out the drive letter. For example
      c:/github/workspace should be defined as /github/workspace`,
      type: 'string',
      demandOption: false,
      default: '/github/workspace',
    });
  }
}
