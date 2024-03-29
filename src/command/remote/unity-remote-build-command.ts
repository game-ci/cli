import { CommandInterface } from '../command-interface.ts';
import { RunnerImageTag, Output } from '../../model/index.ts';
import { core, nanoid, YargsArguments, YargsInstance } from '../../dependencies.ts';
// import Parameters from '../../model/parameters.ts';
// import { GitRepoReader } from '../../model/input-readers/git-repo.ts';
// import { Cli } from '../../model/cli/cli.ts';
// import CloudRunnerConstants from '../../model/cloud-runner/services/cloud-runner-constants.ts';
// import CloudRunnerBuildGuid from '../../model/cloud-runner/services/cloud-runner-guid.ts';
// import { GithubCliReader } from '../../model/input-readers/github-cli.ts';
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
