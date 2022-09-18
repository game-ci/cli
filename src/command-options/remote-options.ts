import { nanoid, YargsArguments, YargsInstance } from '../dependencies.ts';
import { Cli } from '../model/cli/cli.ts';
import { GitRepoReader } from '../model/input-readers/git-repo.ts';
import { GithubCliReader } from '../model/input-readers/github-cli.ts';
import CloudRunnerConstants from '../model/cloud-runner/services/cloud-runner-constants.ts';
import CloudRunnerBuildGuid from '../model/cloud-runner/services/cloud-runner-guid.ts';
import { IOptions } from './options-interface.ts';

export class RemoteOptions implements IOptions {
  public static async configure(yargs: YargsInstance): Promise<void> {
    // const cloudRunnerCluster = Cli.isCliMode
    //   ? this.input.getInput('cloudRunnerCluster') || 'aws'
    //   : this.input.getInput('cloudRunnerCluster') || 'local';

    yargs.option('customJob', {
      description: 'Custom job to run',
      type: 'string',
      demandOption: false,
      default: '',
    });

    // cloudRunnerCluster,
    // cloudRunnerBranch: input.cloudRunnerBranch.split('/').reverse()[0],
    // cloudRunnerIntegrationTests: input.cloudRunnerTests,
    // githubRepo: input.githubRepo || (await GitRepoReader.GetRemote()) || 'game-ci/unity-builder',
    // gitPrivateToken: parameters.gitPrivateToken || (await GithubCliReader.GetGitHubAuthToken()),
    // isCliMode: Cli.isCliMode,
    // awsStackName: input.awsBaseStackName,
    // cloudRunnerBuilderPlatform: input.cloudRunnerBuilderPlatform,
    // awsBaseStackName: input.awsBaseStackName,
    // kubeConfig: input.kubeConfig,
    // cloudRunnerMemory: input.cloudRunnerMemory,
    // cloudRunnerCpu: input.cloudRunnerCpu,
    // kubeVolumeSize: input.kubeVolumeSize,
    // kubeVolume: input.kubeVolume,
    // postBuildSteps: input.postBuildSteps,
    // preBuildSteps: input.preBuildSteps,
    // runNumber: input.runNumber,
    // gitSha: input.gitSha,
    // logId: nanoid.customAlphabet(CloudRunnerConstants.alphabet, 9)(),
    // buildGuid: CloudRunnerBuildGuid.generateGuid(input.runNumber, input.targetPlatform),
    // customJob: input.customJob,
    // customJobHooks: input.customJobHooks(),
    // cachePullOverrideCommand: input.cachePullOverrideCommand(),
    // cachePushOverrideCommand: input.cachePushOverrideCommand(),
    // readInputOverrideCommand: input.readInputOverrideCommand(),
    // readInputFromOverrideList: input.readInputFromOverrideList(),
    // kubeStorageClass: input.kubeStorageClass,
    // checkDependencyHealthOverride: input.checkDependencyHealthOverride,
    // startDependenciesOverride: input.startDependenciesOverride,
    // cacheKey: input.cacheKey,
  }
}
