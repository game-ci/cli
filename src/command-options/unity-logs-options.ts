import type { YargsInstance } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';

/**
 * Unity diagnostic log collection options.
 *
 * Mirrors the orchestrator's `collectUnityLogs` / `streamUnityLogs` inputs so
 * the same flags work whether the user runs `game-ci build` directly against
 * Docker or `game-ci orchestrate` against a remote provider.
 *
 * The orchestrator package owns the canonical path registry; the CLI gathers
 * the most commonly requested files (Editor.log, Unity.Licensing.Client.log,
 * Unity.Entitlements.Audit.log, services-config.json) from the host.
 */
export class UnityLogsOptions implements IOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .option('collectUnityLogs', {
        description: String.dedent`
          Collect Unity-internal logs (Editor.log, Unity.Licensing.Client.log,
          Unity.Entitlements.Audit.log, services-config.json, …) into the
          workspace after the build so they can be uploaded as artifacts.
          Useful when Unity support requests these files.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('collectUnityLogsOnSuccess', {
        description: 'Also collect Unity logs on successful builds (default true).',
        type: 'boolean',
        demandOption: false,
        default: true,
      })
      .option('unityLogCategories', {
        description: String.dedent`
          Comma-separated subset of categories to collect. Default = all
          non-sensitive categories. See orchestrator docs for the full list.`,
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('unityLogsIncludeSensitive', {
        description: 'Include sensitive categories like license-file. Off by default.',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('unityLogsOutputDir', {
        description: 'Override the directory for collected Unity logs. Default <workspace>/Logs/UnityDiagnostics.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('streamUnityLogs', {
        description: 'Live-tail Unity log files during the build and forward each line to stdout.',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('streamUnityLogPaths', {
        description: 'Comma-separated files to live-tail. Defaults to <project>/Builds/Logs/Editor.log.',
        type: 'string',
        demandOption: false,
        default: '',
      });
  }
}
