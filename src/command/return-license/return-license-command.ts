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
 * Returns (and only returns) an active Unity license - it does not activate,
 * build, or test.
 *
 * This is the counterpart `activate` never had. `game-ci activate` deliberately
 * leaves the license active for a later step (ACTIVATE_ONLY, see
 * runsteps.sh), which was harmless while every free-tier user activated from a
 * .ulf: a license file is not a seat, so there was nothing to give back.
 *
 * Unity's move of Personal onto per-organization seats changes that. A seat
 * acquired by `activate` stays consumed until something returns it, and a
 * leaked one makes every later run on the account fail with "no available
 * seats" - so an activate-only flow now needs an explicit way to release it.
 *
 * Note this cannot be wired as a GitHub Action `post:` step from this repo:
 * both action.yml files here are `using: composite`, which cannot declare one.
 * It is the command a wrapper action (game-ci/unity-activate) would invoke.
 */
export class ReturnLicenseCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const { hostPlatform } = options;
    // activateOnly is cleared, not just left alone: the two are mutually
    // exclusive, and a caller spreading in an options bag that still carries
    // activateOnly would otherwise send both flags into the container. The
    // step scripts check RETURN_LICENSE_ONLY first so it would still work
    // today, but that ordering is not something this command should depend on.
    const returnLicenseOptions: Options = { ...options, activateOnly: false, returnLicenseOnly: true };

    PlatformValidation.checkCompatibility(returnLicenseOptions);

    const image = new RunnerImageTag(returnLicenseOptions);
    if (log.isVerbose) log.debug('Using image:', image);

    await PlatformSetup.setup(returnLicenseOptions);

    await log.group('Unity return license', async () => {
      if (hostPlatform === 'darwin') {
        await MacBuilder.run(returnLicenseOptions);
      } else {
        await Docker.run(image.toString(), returnLicenseOptions);
      }
    });

    return true;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await UnityOptions.configure(yargs);
    // Same reasoning as ActivateCommand's: UnityOptions defaults
    // targetPlatform to a build-oriented StandaloneWindows64, but returning a
    // license doesn't build anything - it just needs *an* editor image to run
    // the licensing client inside. NoTarget maps to the generic image and
    // skips build-target validation (e.g. the "Windows builds need 2019.3+"
    // check) entirely.
    yargs.option('targetPlatform', { default: UnityTargetPlatform.NoTarget });
    // Needed by Docker.run() for the container mount path - normally comes
    // from BuildOptions, which this command deliberately doesn't pull in.
    yargs.option('dockerWorkspacePath', {
      description: String.dedent`The path to mount the workspace inside the docker container. For windows, leave out the drive letter. For example
      c:/github/workspace should be defined as /github/workspace`,
      type: 'string',
      demandOption: false,
      default: '/github/workspace',
    });
  }
}
