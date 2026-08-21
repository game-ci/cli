import { CommandInterface } from '../command-interface.ts';
import type { YargsArguments, YargsInstance } from '../../dependencies.ts';
import { CommandBase } from '../command-base.ts';
import { RemoteOptions } from '../../command-options/remote-options.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';
import { Orchestrator, ImageTag } from '../../../plugins/orchestrator/src/model/index.ts';
import { createBuildParametersFromCliOptions } from '../../../plugins/orchestrator/src/cli-plugin/index.ts';

/**
 * Provider-backed orchestration command.
 *
 * Delegates to the real @game-ci/orchestrator engine (`Orchestrator.run`),
 * which itself selects and drives the provider matching --providerStrategy
 * (aws, k8s, local-docker, local-system/local, gcp-cloud-run, azure-aci,
 * github-actions, gitlab-ci, remote-powershell, ansible, ...) and runs the
 * full build/test workflow (setupWorkflow -> workflow -> cleanupWorkflow).
 */
export class UnityOrchestrateCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    const buildParameters = createBuildParametersFromCliOptions(options);
    const baseImage = new ImageTag(buildParameters);

    log.info(`Using provider strategy: ${buildParameters.providerStrategy}`);

    const result = await Orchestrator.run(buildParameters, baseImage.toString());

    log.info(
      `Orchestrated job ${result?.BuildFinished ? 'finished' : 'did not finish'} ` +
        `(succeeded: ${Boolean(result?.BuildSucceeded)}): ${result?.BuildResults ?? ''}`,
    );

    return Boolean(result?.BuildSucceeded);
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await RemoteOptions.configure(yargs);
  }
}
