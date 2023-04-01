import { CommandInterface } from '../command-interface.ts';
import { CacheValidation, Docker, RunnerImageTag, Output } from '../../model/index.ts';
import PlatformSetup from '../../model/platform-setup.ts';
import MacBuilder from '../../model/mac-builder.ts';
import { CommandBase } from '../command-base.ts';
import { UnityOptions } from '../../command-options/unity-options.ts';
import { YargsInstance, Options } from '../../dependencies.ts';
import { VersioningOptions } from '../../command-options/versioning-options.ts';
import { BuildOptions } from '../../command-options/build-options.ts';
import { AndroidOptions } from '../../command-options/android-options.ts';
import { PlatformValidation } from '../../logic/unity/platform-validation/platform-validation.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';

export class UnityBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const { cliPath, hostPlatform } = options;

    PlatformValidation.checkCompatibility(options);
    CacheValidation.verify(options);

    const image = new RunnerImageTag(options);
    if (log.isVerbose) log.debug('Using image:', image);

    await PlatformSetup.setup(options);
    if (hostPlatform === 'darwin') {
      await MacBuilder.run(cliPath);
    } else {
      await Docker.run(image.toString(), options);
    }

    await Output.setBuildVersion(options.buildVersion);
    await Output.setAndroidVersionCode(options.androidVersionCode);

    return false;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await UnityOptions.configure(yargs);
    await VersioningOptions.configure(yargs);
    await BuildOptions.configure(yargs);
    await AndroidOptions.configure(yargs);
  }
}
