import path from 'node:path';
import {
  UnityLogCollectorService,
  UnityLogCollectionOptions,
  UnityLogCollectionResult,
} from './unity-log-collector-service';
import {
  UNITY_LOG_PATHS,
  UnityLogCategory,
  UnityLogPathDefinition,
  listAllUnityLogCategories,
  listSafeUnityLogCategories,
} from './unity-log-paths';
import { UnityLogTailService, UnityLogTailOptions } from './unity-log-tail-service';

export interface LogsCollectOptions extends Omit<
  UnityLogCollectionOptions,
  'workspace' | 'projectPath'
> {
  /** Workspace root. Defaults to process.cwd(). */
  workspace?: string;
  /** Project path. Defaults to workspace. */
  projectPath?: string;
}

export interface LogsTailHandle {
  /** Stop the tail and flush any buffered partial line. */
  stop(): void;
}

/**
 * Convenience facade over the Unity log collection + tailing services.
 *
 * Lets library consumers do:
 *
 *   import { Logs } from '@game-ci/orchestrator';
 *
 *   const result = await Logs.collect({ outputDir: './unity-bundle' });
 *   const tail = Logs.tail({ files: ['/path/to/Editor.log'] });
 *   tail.stop();
 *
 * without reaching into `model/orchestrator/services/output/...`. The
 * underlying `UnityLogCollectorService` and `UnityLogTailService` remain
 * exported for users who need fuller control.
 */
export class Logs {
  /**
   * Collect Unity-internal logs into an artifact directory. Returns the
   * collection result (collected/missing items + manifest path + total bytes).
   *
   * Defaults workspace to `process.cwd()` and projectPath to workspace, so a
   * one-liner like `await Logs.collect()` works on a runner host.
   */
  static async collect(options: LogsCollectOptions = {}): Promise<UnityLogCollectionResult> {
    const workspace = options.workspace || process.cwd();
    const projectPath = options.projectPath || workspace;

    return UnityLogCollectorService.collect({
      ...options,
      workspace,
      projectPath,
    });
  }

  /**
   * Live-tail one or more Unity log files. Returns a handle with `stop()`.
   *
   * If `files` is omitted, tails the unity-builder default
   * `<projectPath>/Builds/Logs/Editor.log` and the orchestrator-collected
   * `<workspace>/Logs/UnityDiagnostics/editor-log/Editor.log` once it lands.
   */
  static tail(
    options: Partial<UnityLogTailOptions> & {
      workspace?: string;
      projectPath?: string;
    } = {},
  ): LogsTailHandle {
    const workspace = options.workspace || process.cwd();
    const projectPath = options.projectPath || workspace;
    const files =
      options.files && options.files.length > 0
        ? options.files
        : [
            path.join(projectPath, 'Builds', 'Logs', 'Editor.log'),
            path.join(workspace, 'Logs', 'UnityDiagnostics', 'editor-log', 'Editor.log'),
          ];

    const service = new UnityLogTailService({
      ...options,
      files,
    });
    service.start();
    return { stop: () => service.stop() };
  }

  /**
   * List every known log category with its description and sensitivity flag.
   * Useful for building UIs/CLIs that surface what `Logs.collect()` will pick up.
   */
  static categories(): UnityLogPathDefinition[] {
    return UNITY_LOG_PATHS.slice();
  }

  /**
   * List safe (non-sensitive) category identifiers — the default set when
   * `categories` is omitted from `Logs.collect`.
   */
  static safeCategoryIds(): UnityLogCategory[] {
    return listSafeUnityLogCategories();
  }

  /**
   * List every category identifier including sensitive ones.
   */
  static allCategoryIds(): UnityLogCategory[] {
    return listAllUnityLogCategories();
  }

  /**
   * Parse a comma-separated category list string (e.g. from a CLI flag),
   * dropping unknown entries and treating "all"/empty as "default set".
   */
  static parseCategories(input: string | undefined): UnityLogCategory[] | undefined {
    return UnityLogCollectorService.parseCategories(input);
  }
}
