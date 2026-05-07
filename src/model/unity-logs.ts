import { fsSync as fs, path } from '../dependencies.ts';
import os from 'node:os';

/**
 * Lightweight Unity log collector for the CLI.
 *
 * The canonical implementation lives in @game-ci/orchestrator
 * (UnityLogCollectorService). The CLI keeps a slim subset that covers the
 * categories Unity support most often asks for: Editor.log,
 * Unity.Licensing.Client.log, Unity.Entitlements.Audit.log,
 * services-config.json, build-report, bee-backend, project-version,
 * package-manifest. Users who need the full path registry should run via
 * the orchestrator.
 */

export type UnityLogPlatform = 'linux' | 'darwin' | 'win32';

interface PathDef {
  category: string;
  description: string;
  paths: Partial<Record<UnityLogPlatform, string[]>>;
  workspaceRelative?: boolean;
  sensitive?: boolean;
  isDirectory?: boolean;
}

const PATHS: PathDef[] = [
  {
    category: 'editor-log',
    description: 'Unity Editor.log',
    paths: {
      linux: ['$HOME/.config/unity3d/Editor.log'],
      darwin: ['$HOME/Library/Logs/Unity/Editor.log'],
      win32: ['$LOCALAPPDATA/Unity/Editor/Editor.log'],
    },
  },
  {
    category: 'licensing-client',
    description: 'Unity.Licensing.Client.log',
    paths: {
      linux: ['$HOME/.config/unity3d/Unity/Unity.Licensing.Client.log'],
      darwin: ['$HOME/Library/Logs/Unity/Unity.Licensing.Client.log'],
      win32: ['$LOCALAPPDATA/Unity/Unity.Licensing.Client.log'],
    },
  },
  {
    category: 'entitlements-audit',
    description: 'Unity.Entitlements.Audit.log',
    paths: {
      linux: ['$HOME/.config/unity3d/Unity/Unity.Entitlements.Audit.log'],
      darwin: ['$HOME/Library/Logs/Unity/Unity.Entitlements.Audit.log'],
      win32: ['$LOCALAPPDATA/Unity/Unity.Entitlements.Audit.log'],
    },
  },
  {
    category: 'services-config',
    description: 'services-config.json',
    paths: {
      linux: ['/usr/share/unity3d/config/services-config.json'],
      darwin: ['/Library/Application Support/Unity/config/services-config.json'],
      win32: ['$PROGRAMDATA/Unity/config/services-config.json'],
    },
  },
  {
    category: 'build-report',
    description: 'LastBuild.buildreport',
    workspaceRelative: true,
    paths: {
      linux: ['$PROJECT/Library/LastBuild.buildreport'],
      darwin: ['$PROJECT/Library/LastBuild.buildreport'],
      win32: ['$PROJECT/Library/LastBuild.buildreport'],
    },
  },
  {
    category: 'bee-backend',
    description: 'bee_backend.log',
    workspaceRelative: true,
    paths: {
      linux: ['$PROJECT/Library/Bee/bee_backend.log'],
      darwin: ['$PROJECT/Library/Bee/bee_backend.log'],
      win32: ['$PROJECT/Library/Bee/bee_backend.log'],
    },
  },
  {
    category: 'project-version',
    description: 'ProjectVersion.txt',
    workspaceRelative: true,
    paths: {
      linux: ['$PROJECT/ProjectSettings/ProjectVersion.txt'],
      darwin: ['$PROJECT/ProjectSettings/ProjectVersion.txt'],
      win32: ['$PROJECT/ProjectSettings/ProjectVersion.txt'],
    },
  },
  {
    category: 'package-manifest',
    description: 'Packages/manifest.json + packages-lock.json',
    workspaceRelative: true,
    paths: {
      linux: ['$PROJECT/Packages/manifest.json', '$PROJECT/Packages/packages-lock.json'],
      darwin: ['$PROJECT/Packages/manifest.json', '$PROJECT/Packages/packages-lock.json'],
      win32: ['$PROJECT/Packages/manifest.json', '$PROJECT/Packages/packages-lock.json'],
    },
  },
];

export interface UnityLogsCollectOptions {
  workspace: string;
  projectPath: string;
  outputDir?: string;
  categories?: string[];
  includeSensitive?: boolean;
  platform?: UnityLogPlatform;
  env?: NodeJS.ProcessEnv;
}

export class UnityLogs {
  static collect(options: UnityLogsCollectOptions): { outputDir: string; collected: string[]; missing: string[] } {
    const platform: UnityLogPlatform = options.platform || UnityLogs.detectPlatform();
    const env = options.env || process.env;
    const projectFullPath = path.isAbsolute(options.projectPath)
      ? options.projectPath
      : path.join(options.workspace, options.projectPath || '');
    const outputDir =
      options.outputDir || path.join(options.workspace, 'Logs', 'UnityDiagnostics');

    fs.mkdirSync(outputDir, { recursive: true });

    const filtered = options.categories && options.categories.length > 0
      ? PATHS.filter((definition) => options.categories!.includes(definition.category))
      : PATHS.filter((definition) => !definition.sensitive || options.includeSensitive);

    const tokens: Record<string, string> = {
      HOME: env.HOME || os.homedir(),
      USERPROFILE: env.USERPROFILE || os.homedir(),
      LOCALAPPDATA: env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      APPDATA: env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      PROGRAMDATA: env.PROGRAMDATA || 'C:/ProgramData',
      WORKSPACE: options.workspace,
      PROJECT: projectFullPath,
    };

    const collected: string[] = [];
    const missing: string[] = [];

    for (const definition of filtered) {
      const templates = definition.paths[platform] || [];
      let foundOne = false;
      for (const template of templates) {
        const sourcePath = template.replace(/\$([A-Z_]+)/g, (full, name) =>
          tokens[name] !== undefined ? tokens[name] : full,
        );
        if (!fs.existsSync(sourcePath)) continue;
        try {
          const targetBase = path.join(outputDir, definition.category);
          fs.mkdirSync(targetBase, { recursive: true });
          const targetFile = path.join(targetBase, path.basename(sourcePath));
          fs.copyFileSync(sourcePath, targetFile);
          collected.push(`${definition.category}: ${sourcePath}`);
          foundOne = true;
        } catch (error: any) {
          log.warning(`[UnityLogs] copy failed for ${definition.category}: ${error.message}`);
        }
      }
      if (!foundOne) missing.push(definition.category);
    }

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          platform,
          projectPath: projectFullPath,
          collected,
          missing,
        },
        null,
        2,
      ),
      'utf8',
    );

    log.info(`[UnityLogs] collected ${collected.length} item(s) → ${outputDir}`);
    if (missing.length > 0) {
      log.info(`[UnityLogs] missing categories: ${missing.join(', ')}`);
    }

    return { outputDir, collected, missing };
  }

  /**
   * Live-tail a list of files. Returns a stop() function.
   */
  static streamFiles(files: string[]): () => void {
    const positions = new Map<string, number>();
    const buffers = new Map<string, string>();
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const stat = fs.statSync(file);
        const previous = positions.get(file) ?? 0;
        if (stat.size <= previous) {
          if (stat.size < previous) positions.set(file, 0);
          continue;
        }
        const buffer = Buffer.alloc(stat.size - previous);
        const fd = fs.openSync(file, 'r');
        try {
          fs.readSync(fd, buffer, 0, buffer.length, previous);
        } finally {
          fs.closeSync(fd);
        }
        positions.set(file, stat.size);
        const text = (buffers.get(file) || '') + buffer.toString('utf8');
        const lines = text.split(/\r?\n/);
        const last = lines.pop();
        buffers.set(file, last || '');
        for (const line of lines) {
          if (line) log.info(`[UnityLogs] ${path.basename(file)}: ${line}`);
        }
      }
    };

    const interval = setInterval(tick, 1000);
    return () => {
      stopped = true;
      clearInterval(interval);
      tick();
    };
  }

  static detectPlatform(): UnityLogPlatform {
    if (process.platform === 'darwin') return 'darwin';
    if (process.platform === 'win32') return 'win32';
    return 'linux';
  }

  static parseCategories(input: string | undefined): string[] | undefined {
    if (!input) return undefined;
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'all') return undefined;
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

