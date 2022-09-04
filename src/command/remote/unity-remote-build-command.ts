import { CommandInterface } from '../command-interface.ts';
import { CloudRunner, ImageTag, Input, Output } from '../../model/index.ts';
import { core, nanoid, YargsArguments, YargsInstance } from '../../dependencies.ts';
import Parameters from '../../model/parameters.ts';
import { GitRepoReader } from '../../model/input-readers/git-repo.ts';
import { Cli } from '../../model/cli/cli.ts';
import CloudRunnerConstants from '../../model/cloud-runner/services/cloud-runner-constants.ts';
import CloudRunnerBuildGuid from '../../model/cloud-runner/services/cloud-runner-guid.ts';
import { GithubCliReader } from '../../model/input-readers/github-cli.ts';
import { CommandBase } from '../command-base.ts';
import { RemoteOptions } from '../../command-options/remote-options.ts';

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

  configureOptions(yargs: YargsInstance): Promise<void> {
    RemoteOptions.configure(yargs);
  }
}
