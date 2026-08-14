import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import OrchestratorLogger from '../core/orchestrator-logger';
import {
  UNITY_LOG_PATHS,
  UnityLogCategory,
  UnityLogPathDefinition,
  UnityLogPlatform,
  getUnityLogPath,
  listAllUnityLogCategories,
  listSafeUnityLogCategories,
} from './unity-log-paths';

export interface UnityLogCollectionOptions {
  /** Workspace root (used to resolve $WORKSPACE). */
  workspace: string;
  /** Project path (used to resolve $PROJECT). May be relative to workspace. */
  projectPath: string;
  /** Where to write collected files. Defaults to <workspace>/Logs/UnityDiagnostics. */
  outputDir?: string;
  /** Specific categories to collect. Empty/undefined = all non-sensitive. */
  categories?: UnityLogCategory[];
  /** Include sensitive categories (e.g. license file). Default false. */
  includeSensitive?: boolean;
  /** Force a specific platform for path resolution. Defaults to host OS. */
  platform?: UnityLogPlatform;
  /** Override env-var lookup (useful for tests / mocked envs). */
  env?: NodeJS.ProcessEnv;
  /** Whether to also walk classic workspace fallback paths (Builds/Logs/Editor.log etc.). */
  includeWorkspaceFallbacks?: boolean;
  /** Whether to capture Windows Event Log via PowerShell. Default true on win32. */
  captureWindowsEventLog?: boolean;
}

export interface UnityLogCollectionResultItem {
  category: UnityLogCategory;
  description: string;
  source: string;
  destination: string;
  bytes: number;
  isDirectory: boolean;
}

export interface UnityLogCollectionResult {
  outputDir: string;
  collected: UnityLogCollectionResultItem[];
  missing: { category: UnityLogCategory; expectedPaths: string[] }[];
  manifestPath: string;
  totalBytes: number;
}

/**
 * Collects Unity-internal log/diagnostic files into a single artifact directory.
 *
 * Designed for the case where Unity support requests Editor.log, licensing
 * logs, services-config.json, etc. Most of these live OUTSIDE the project
 * workspace at fixed OS paths and are otherwise invisible to the CI artifact
 * upload step.
 *
 * Sensitive paths (e.g. Unity_lic.ulf) are skipped unless explicitly opted
 * into via `includeSensitive: true`.
 */
export class UnityLogCollectorService {
  static collect(options: UnityLogCollectionOptions): UnityLogCollectionResult {
    const platform: UnityLogPlatform =
      options.platform || UnityLogCollectorService.detectPlatform();
    const env = options.env || process.env;
    const projectFullPath = path.isAbsolute(options.projectPath)
      ? options.projectPath
      : path.join(options.workspace, options.projectPath);
    const outputDir = options.outputDir || path.join(options.workspace, 'Logs', 'UnityDiagnostics');

    fs.mkdirSync(outputDir, { recursive: true });

    const requested = UnityLogCollectorService.resolveCategories(
      options.categories,
      options.includeSensitive,
    );

    const collected: UnityLogCollectionResultItem[] = [];
    const missing: { category: UnityLogCategory; expectedPaths: string[] }[] = [];

    for (const definition of requested) {
      const expandedPaths = UnityLogCollectorService.expandPaths(
        definition,
        platform,
        env,
        options.workspace,
        projectFullPath,
      );

      let foundOne = false;
      for (const sourcePath of expandedPaths) {
        const matches = UnityLogCollectorService.expandGlob(sourcePath);
        for (const match of matches) {
          try {
            const item = UnityLogCollectorService.copyToOutput(definition, match, outputDir);
            if (item) {
              collected.push(item);
              foundOne = true;
            }
          } catch (error: any) {
            OrchestratorLogger.logWarning(
              `[UnityLogs] Failed to copy ${match} (${definition.category}): ${error.message}`,
            );
          }
        }
      }

      if (!foundOne && definition.windowsCommand && platform === 'win32') {
        if (options.captureWindowsEventLog !== false) {
          const item = UnityLogCollectorService.runWindowsCommand(definition, outputDir);
          if (item) {
            collected.push(item);
            foundOne = true;
          }
        }
      }

      if (
        !foundOne &&
        options.includeWorkspaceFallbacks !== false &&
        definition.category === 'editor-log'
      ) {
        const fallback = path.join(projectFullPath, 'Builds', 'Logs', 'Editor.log');
        if (fs.existsSync(fallback)) {
          const item = UnityLogCollectorService.copyToOutput(definition, fallback, outputDir);
          if (item) {
            collected.push(item);
            foundOne = true;
          }
        }
      }

      if (!foundOne) {
        missing.push({ category: definition.category, expectedPaths: expandedPaths });
      }
    }

    const totalBytes = collected.reduce((sum, item) => sum + item.bytes, 0);
    const manifestPath = path.join(outputDir, 'manifest.json');
    const manifest = {
      generatedAt: new Date().toISOString(),
      platform,
      workspace: options.workspace,
      projectPath: projectFullPath,
      includeSensitive: !!options.includeSensitive,
      collected: collected.map((c) => ({
        category: c.category,
        description: c.description,
        source: c.source,
        destination: path.relative(outputDir, c.destination),
        bytes: c.bytes,
        isDirectory: c.isDirectory,
      })),
      missing,
      totalBytes,
    };
    try {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[UnityLogs] Failed to write manifest: ${error.message}`);
    }

    OrchestratorLogger.log(
      `[UnityLogs] Collected ${collected.length} item(s) (${totalBytes} bytes) to ${outputDir}`,
    );
    if (missing.length > 0) {
      OrchestratorLogger.log(
        `[UnityLogs] ${missing.length} categor${missing.length === 1 ? 'y' : 'ies'} not found: ${missing
          .map((m) => m.category)
          .join(', ')}`,
      );
    }

    return { outputDir, collected, missing, manifestPath, totalBytes };
  }

  static resolveCategories(
    categories: UnityLogCategory[] | undefined,
    includeSensitive: boolean | undefined,
  ): UnityLogPathDefinition[] {
    if (!categories || categories.length === 0) {
      const names = includeSensitive ? listAllUnityLogCategories() : listSafeUnityLogCategories();
      return names
        .map((category) => getUnityLogPath(category))
        .filter((definition): definition is UnityLogPathDefinition => Boolean(definition));
    }

    const result: UnityLogPathDefinition[] = [];
    for (const name of categories) {
      const definition = getUnityLogPath(name);
      if (!definition) {
        OrchestratorLogger.logWarning(`[UnityLogs] Unknown category '${name}', skipping`);
        continue;
      }
      if (definition.sensitive && !includeSensitive) {
        OrchestratorLogger.logWarning(
          `[UnityLogs] Skipping sensitive category '${name}' — pass includeSensitive to collect it.`,
        );
        continue;
      }
      result.push(definition);
    }
    return result;
  }

  static parseCategories(input: string | undefined): UnityLogCategory[] | undefined {
    if (!input) return undefined;
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'all') return undefined;
    const known = new Set(UNITY_LOG_PATHS.map((definition) => definition.category));
    return trimmed
      .split(',')
      .map((s) => s.trim() as UnityLogCategory)
      .filter((s) => s && known.has(s));
  }

  static expandPaths(
    definition: UnityLogPathDefinition,
    platform: UnityLogPlatform,
    env: NodeJS.ProcessEnv,
    workspace: string,
    projectFullPath: string,
  ): string[] {
    const templates = definition.paths[platform] || [];
    const tokens: Record<string, string> = {
      HOME: env.HOME || os.homedir(),
      USERPROFILE: env.USERPROFILE || os.homedir(),
      LOCALAPPDATA: env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      APPDATA: env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      PROGRAMDATA: env.PROGRAMDATA || 'C:/ProgramData',
      WORKSPACE: workspace,
      PROJECT: projectFullPath,
      UNITY_VERSION: env.UNITY_VERSION || '',
      COMPANY: env.UNITY_COMPANY || '*',
      GAME: env.UNITY_PRODUCT || '*',
    };

    return templates.map((template) =>
      template.replace(/\$([A-Z_]+)/g, (full, name: string) =>
        tokens[name] !== undefined ? tokens[name] : full,
      ),
    );
  }

  static expandGlob(pattern: string): string[] {
    if (!pattern.includes('*')) {
      return fs.existsSync(pattern) ? [pattern] : [];
    }

    const segments = pattern.replace(/\\/g, '/').split('/');
    const fixedParts: string[] = [];
    for (const segment of segments) {
      if (segment.includes('*')) break;
      fixedParts.push(segment);
    }
    const fixedPrefix = fixedParts.join('/');
    if (!fs.existsSync(fixedPrefix || '.')) return [];

    const results: string[] = [];
    UnityLogCollectorService.walkGlob(
      fixedPrefix || '.',
      segments.slice(fixedParts.length),
      results,
    );
    return results;
  }

  private static walkGlob(currentDir: string, remaining: string[], results: string[]): void {
    if (remaining.length === 0) {
      results.push(currentDir);
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    const [pattern, ...rest] = remaining;
    const regex = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );

    for (const entry of entries) {
      if (!regex.test(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (rest.length === 0) {
        results.push(fullPath);
      } else if (entry.isDirectory()) {
        UnityLogCollectorService.walkGlob(fullPath, rest, results);
      }
    }
  }

  private static copyToOutput(
    definition: UnityLogPathDefinition,
    sourcePath: string,
    outputDir: string,
  ): UnityLogCollectionResultItem | null {
    if (!fs.existsSync(sourcePath)) return null;
    const stat = fs.statSync(sourcePath);
    const targetBase = path.join(outputDir, definition.category);
    fs.mkdirSync(targetBase, { recursive: true });

    if (stat.isDirectory()) {
      const targetDir = path.join(targetBase, path.basename(sourcePath));
      const bytes = UnityLogCollectorService.copyDirectory(sourcePath, targetDir);
      return {
        category: definition.category,
        description: definition.description,
        source: sourcePath,
        destination: targetDir,
        bytes,
        isDirectory: true,
      };
    }

    const targetFile = path.join(targetBase, path.basename(sourcePath));
    fs.copyFileSync(sourcePath, targetFile);
    return {
      category: definition.category,
      description: definition.description,
      source: sourcePath,
      destination: targetFile,
      bytes: stat.size,
      isDirectory: false,
    };
  }

  private static copyDirectory(source: string, target: string): number {
    fs.mkdirSync(target, { recursive: true });
    let totalBytes = 0;
    const entries = fs.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      const sourceEntry = path.join(source, entry.name);
      const targetEntry = path.join(target, entry.name);
      if (entry.isDirectory()) {
        totalBytes += UnityLogCollectorService.copyDirectory(sourceEntry, targetEntry);
      } else if (entry.isFile()) {
        fs.copyFileSync(sourceEntry, targetEntry);
        totalBytes += fs.statSync(targetEntry).size;
      }
    }
    return totalBytes;
  }

  private static runWindowsCommand(
    definition: UnityLogPathDefinition,
    outputDir: string,
  ): UnityLogCollectionResultItem | null {
    if (!definition.windowsCommand) return null;
    const targetBase = path.join(outputDir, definition.category);
    fs.mkdirSync(targetBase, { recursive: true });
    const targetFile = path.join(targetBase, `${definition.category}.txt`);

    try {
      const output = execSync(`powershell -NoProfile -Command "${definition.windowsCommand}"`, {
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
      });
      fs.writeFileSync(targetFile, output, 'utf8');
      const stat = fs.statSync(targetFile);
      return {
        category: definition.category,
        description: definition.description,
        source: 'powershell:' + definition.category,
        destination: targetFile,
        bytes: stat.size,
        isDirectory: false,
      };
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[UnityLogs] PowerShell capture failed for ${definition.category}: ${error.message}`,
      );
      return null;
    }
  }

  static detectPlatform(): UnityLogPlatform {
    if (process.platform === 'darwin') return 'darwin';
    if (process.platform === 'win32') return 'win32';
    return 'linux';
  }

  /**
   * Generate a shell script that copies Unity-internal log files from inside
   * a Linux Unity build container to a workspace-relative directory before
   * the container exits.
   *
   * The unity-builder Linux build container does not by default mount
   * `/root/.config/unity3d` to the host. Injecting this snippet as a
   * post-build step preserves the logs Unity support most often asks for.
   */
  static buildContainerCopyScript(workspaceMountPath: string): string {
    const target = `${workspaceMountPath.replace(/\/$/, '')}/Logs/UnityDiagnostics`;
    return [
      `mkdir -p "${target}/editor-log" "${target}/licensing-client" "${target}/entitlements-audit" "${target}/services-config" "${target}/editor-crash" "${target}/bee-backend" "${target}/build-report"`,
      `cp -f /root/.config/unity3d/Editor.log "${target}/editor-log/" 2>/dev/null || true`,
      `cp -f /root/.config/unity3d/Editor-prev.log "${target}/editor-log/" 2>/dev/null || true`,
      `cp -f /root/.config/unity3d/Unity/Unity.Licensing.Client.log "${target}/licensing-client/" 2>/dev/null || true`,
      `cp -f /root/.config/unity3d/Unity/Unity.Entitlements.Audit.log "${target}/entitlements-audit/" 2>/dev/null || true`,
      `cp -f /usr/share/unity3d/config/services-config.json "${target}/services-config/" 2>/dev/null || true`,
      `cp -rf /root/.config/unity3d/Crashes "${target}/editor-crash/" 2>/dev/null || true`,
      `find "${workspaceMountPath}" -maxdepth 6 -name 'bee_backend.log' -exec cp -f {} "${target}/bee-backend/" \\; 2>/dev/null || true`,
      `find "${workspaceMountPath}" -maxdepth 6 -name 'LastBuild.buildreport' -exec cp -f {} "${target}/build-report/" \\; 2>/dev/null || true`,
    ].join(' && ');
  }
}
