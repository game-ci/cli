import { CommandInterface } from '../command-interface.ts';
import type { YargsArguments, YargsInstance } from '../../dependencies.ts';
import { CommandBase } from '../command-base.ts';
import { RemoteOptions } from '../../command-options/remote-options.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';

// Todo - Verify this entire flow
export class UnityRemoteBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    // Todo - reimplement this using options instead of parameters.
    // const { buildParameters } = options;
    // const baseImage = new ImageTag(buildParameters);
    //
    // const result = await CloudRunner.run(buildParameters, baseImage.toString());
    // const { status, output } = result;
    //
    // await Output.setBuildVersion(buildParameters.buildVersion);
    //
    // return status.success;

    return false;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await RemoteOptions.configure(yargs);
  }
}
