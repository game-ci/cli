import fs from 'node:fs';
import path from 'node:path';
import BuildParameters from '../../../build-parameters';
import { OrchestratorSystem } from '../../services/core/orchestrator-system';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import OrchestratorSecret from '../../options/orchestrator-secret';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';
import { quote } from 'shell-quote';
import Orchestrator from '../../orchestrator';
import { UnityRetryService } from '../../services/reliability/unity-retry-service';
import { UnityRecoveryService } from '../../services/reliability/unity-recovery-service';

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
    let command = commands;
    if (process.platform === 'win32') {
      const inline = commands
        .replace(/\r/g, '')
        .split('\n')
        .filter((x) => x.trim().length > 0)
        .join(' ; ');

      // Use shell-quote to properly escape the command string, preventing command injection
      command = `bash -lc ${quote([inline])}`;
    }

    // Opt-in (--enableBuildRetry, default off): wrap the whole invocation in
    // UnityRetryService's classify -> decide -> retry loop, entirely
    // encapsulated inside this provider. Every provider strategy other than
    // local/local-system goes through their own OrchestratorSystem.Run calls
    // untouched, and the ProviderInterface contract is unchanged -- callers
    // above (e.g. BuildAutomationWorkflow) keep awaiting a plain
    // Promise<string>, same as before this feature existed.
    if (Orchestrator.buildParameters?.enableBuildRetry) {
      return await LocalOrchestrator.runWithRetry(command);
    }

    return await OrchestratorSystem.Run(command);
  }

  /**
   * Runs `command` under UnityRetryService.executeWithRetry: on a non-zero
   * exit, classify the failure (UnityBuildDiagnosticsService), decide on a
   * budget-gated recovery action (UnityRecoveryService -- may back up/nuke
   * the Library folder or clear subfolders), perform it, then retry the
   * same command again, up to UnityRetryService's own attempt cap.
   *
   * `logText` is read from the real Unity Editor log rather than only the
   * wrapper's captured stdout/stderr: dist/platforms/ubuntu/steps/runsteps.sh
   * (via build.sh/activate.sh) invokes `unity-editor -logfile /dev/stdout`,
   * and BuildAutomationWorkflow.BuildWorkflow pipes that whole pipeline
   * through `node <builder> -m remote-cli-log-stream --logFile "$LOG_FILE"`,
   * which appends every line to $LOG_FILE. For the bare-local provider,
   * $LOG_FILE is exported as `$(pwd)/temp/job-log.txt` (see
   * BuildAutomationWorkflow.BuildWorkflow), so that file accumulates the
   * genuine Editor log content that UnityBuildDiagnosticsService's crash/
   * license/compile patterns are meant to match against -- not just whatever
   * subset `command`'s own stdout capture happens to contain.
   */
  private static async runWithRetry(command: string): Promise<string> {
    const bp = Orchestrator.buildParameters;
    const projectPath = path.isAbsolute(bp.projectPath || '')
      ? bp.projectPath
      : path.join(process.cwd(), bp.projectPath || '.');
    const logFilePath = path.join(process.cwd(), 'temp', 'job-log.txt');

    let lastOutput = '';

    const result = await UnityRetryService.executeWithRetry(
      projectPath,
      async () => {
        const startedAtMs = Date.now();
        let exitCode = 0;

        // suppressError=true: on a non-zero exit, OrchestratorSystem.Run
        // resolves with the captured output instead of throwing, so the
        // retry loop can inspect the result and decide whether to retry --
        // exactly mirroring how the non-retry path above lets a throw
        // propagate on the single, non-retried attempt.
        const stdout = await OrchestratorSystem.Run(command, true, false, undefined, (code) => {
          exitCode = code;
        });
        lastOutput = stdout;

        const runtimeSeconds = (Date.now() - startedAtMs) / 1000;
        const logText = LocalOrchestrator.readEditorLog(logFilePath) || stdout;

        return { exitCode, logText, runtimeSeconds };
      },
      { budgets: UnityRecoveryService.createDefaultBudgets() },
    );

    if (!result.succeeded) {
      const category = result.lastDiagnostics?.failureCategory ?? 'UNKNOWN';
      const hint = result.lastDiagnostics?.failureSummary?.remediationHint ?? '';
      throw new Error(
        `Unity build failed after ${result.attempts} attempt(s) via UnityRetryService ` +
          `[${category}]${hint ? `: ${hint}` : ''}. Actions performed: ` +
          `${result.actionsPerformed.join(', ') || 'none'}.\n${lastOutput}`,
      );
    }

    return lastOutput;
  }

  private static readEditorLog(logFilePath: string): string {
    try {
      return fs.readFileSync(logFilePath, 'utf8');
    } catch {
      return '';
    }
  }
}
export default LocalOrchestrator;
