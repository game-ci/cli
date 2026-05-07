import type { YargsArguments, YargsInstance } from '../../dependencies.ts';
import { CommandBase } from '../command-base.ts';
import { CommandInterface } from '../command-interface.ts';
import { UnityLogs } from '../../model/unity-logs.ts';
import { UnityLogsOptions } from '../../command-options/unity-logs-options.ts';

/**
 * Top-level dispatch for `game-ci logs <subcommand>`.
 *
 * Subcommands:
 *   collect - run the Unity log collector against the local host (or a path)
 *   tail    - live-tail one or more Unity log files
 *   pull    - (stub) collect from a remote runner via the provider interface
 *   fetch   - (stub) fetch logs persisted from a past orchestrator build
 */
export class UnityLogsCommand extends CommandBase implements CommandInterface {
  private readonly subCommand: string;

  constructor(commandName: string, subCommand: string) {
    super(commandName);
    this.subCommand = subCommand || 'collect';
  }

  public async execute(options: YargsArguments): Promise<boolean> {
    switch (this.subCommand) {
      case 'collect':
        return this.runCollect(options);
      case 'tail':
        return this.runTail(options);
      case 'pull':
        log.warning(
          '[logs pull] Remote provider pulls are not implemented yet. ' +
            'For now, ssh into the runner and run `game-ci logs collect` directly. ' +
            'Tracking: https://github.com/game-ci/orchestrator/issues',
        );
        return false;
      case 'fetch':
        log.warning(
          '[logs fetch] Retroactive fetch from past orchestrator builds is not implemented yet. ' +
            'For now, the diagnostic bundle is uploaded as a build artifact when collectUnityLogs=true. ' +
            'Tracking: https://github.com/game-ci/orchestrator/issues',
        );
        return false;
      default:
        log.error(
          `Unknown logs subcommand: ${this.subCommand}. ` +
            `Valid subcommands: collect, tail, pull, fetch.`,
        );
        return false;
    }
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    yargs
      .option('projectPath', {
        description: 'Path to the Unity project (defaults to cwd).',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('workspace', {
        description: 'Workspace root (defaults to projectPath or cwd).',
        type: 'string',
        demandOption: false,
        default: '',
      });
    await UnityLogsOptions.configure(yargs);
  }

  private async runCollect(options: YargsArguments): Promise<boolean> {
    const workspace = (options.workspace as string) || (options.projectPath as string) || process.cwd();
    const projectPath = (options.projectPath as string) || workspace;
    const result = UnityLogs.collect({
      workspace,
      projectPath,
      outputDir: (options.unityLogsOutputDir as string) || undefined,
      categories: UnityLogs.parseCategories(options.unityLogCategories as string | undefined),
      includeSensitive: !!options.unityLogsIncludeSensitive,
    });

    log.info(`[logs collect] Collected ${result.collected.length} item(s) → ${result.outputDir}`);
    if (result.missing.length > 0) {
      log.info(`[logs collect] Missing categories on this host: ${result.missing.join(', ')}`);
    }
    return false;
  }

  private async runTail(options: YargsArguments): Promise<boolean> {
    const projectPath =
      (options.projectPath as string) || (options.workspace as string) || process.cwd();
    const explicit = String(options.streamUnityLogPaths || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const defaults = [`${projectPath}/Builds/Logs/Editor.log`];
    const files = explicit.length > 0 ? explicit : defaults;

    log.info(`[logs tail] Tailing ${files.length} file(s) — Ctrl+C to stop`);
    const stop = UnityLogs.streamFiles(files);

    const onSignal = (): void => {
      stop();
      process.exit(0);
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    return new Promise<boolean>(() => {
      // Resolves only on signal; tail runs until interrupted.
    });
  }
}
