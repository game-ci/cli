import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { quote } from 'shell-quote';

class LocalOrchestrator implements ProviderInterface {
  listResources(): Promise<ProviderResource[]> {
    throw new Error('Method not implemented.');
  }
  listWorkflow(): Promise<ProviderWorkflow[]> {
    throw new Error('Method not implemented.');
  }
  watchWorkflow(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  // The `local`/`local-system` provider runs Unity directly on a self-hosted
  // machine that already exists independently of this process -- it does not
  // provision or own any cloud resources (ECS tasks, k8s pods/PVCs, S3/EBS
  // volumes, ...) the way aws/k8s do. There is therefore nothing for this
  // provider to garbage-collect: no-op success rather than a fabricated
  // cleanup of resources this provider never owned. Must not throw --
  // Orchestrator.run()'s constantGarbageCollection path and gcTimeoutMinutes
  // finally-block both call this unconditionally, and previously this threw
  // 'Method not implemented.', hard-failing that cleanup path for local runs.
  async garbageCollect(
    // eslint-disable-next-line no-unused-vars
    filter: string,
    // eslint-disable-next-line no-unused-vars
    previewOnly: boolean,
    // eslint-disable-next-line no-unused-vars
    olderThan: number,
    // eslint-disable-next-line no-unused-vars
    fullCache: boolean,
    // eslint-disable-next-line no-unused-vars
    baseDependencies: boolean,
  ): Promise<string> {
    OrchestratorLogger.log(
      'LocalOrchestrator.garbageCollect: no-op (the local/local-system provider owns no cloud resources to clean up)',
    );

    return 'nothing to garbage-collect for provider=local';
  }
  cleanupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: {
      ParameterKey: string;
      EnvironmentVariable: string;
      ParameterValue: string;
    }[],
  ) {}
  public setupWorkflow(
    // eslint-disable-next-line no-unused-vars
    buildGuid: string,
    // eslint-disable-next-line no-unused-vars
    buildParameters: BuildParameters,
    // eslint-disable-next-line no-unused-vars
    branchName: string,
    // eslint-disable-next-line no-unused-vars
    defaultSecretsArray: {
      ParameterKey: string;
      EnvironmentVariable: string;
      ParameterValue: string;
    }[],
  ) {}
  public async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    // eslint-disable-next-line no-unused-vars
    mountdir: string,
    // eslint-disable-next-line no-unused-vars
    workingdir: string,
    // eslint-disable-next-line no-unused-vars
    environment: OrchestratorEnvironmentVariable[],
    // eslint-disable-next-line no-unused-vars
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    OrchestratorLogger.log(image);
    OrchestratorLogger.log(buildGuid);
    OrchestratorLogger.log(commands);

    // On Windows, many built-in hooks use POSIX shell syntax. Execute via bash if available.
    if (process.platform === 'win32') {
      const inline = commands
        .replace(/\r/g, '')
        .split('\n')
        .filter((x) => x.trim().length > 0)
        .join(' ; ');

      // Use shell-quote to properly escape the command string, preventing command injection
      const bashWrapped = `bash -lc ${quote([inline])}`;

      return await OrchestratorSystem.Run(bashWrapped);
    }

    return await OrchestratorSystem.Run(commands);
  }
}
export default LocalOrchestrator;
