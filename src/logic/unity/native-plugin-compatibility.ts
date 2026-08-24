import { fsSync as fs, path, yaml } from '../../dependencies.ts';

export interface WindowsOnlyEditorPlugin {
  /** Path to the .dll (not the .meta), relative to projectPath, for a readable warning message. */
  path: string;
  guid?: string;
}

/**
 * Unity serializes a PluginImporter's platformData as a YAML array of
 * `{ first: {...}, second: {...} }` pairs - its own convention for what's
 * conceptually a Dictionary<BuildTarget, PluginImporterPlatformData>, not a
 * plain YAML mapping. A real Windows-only-Editor entry looks like:
 *
 *   PluginImporter:
 *     ...
 *     platformData:
 *     - first:
 *         Editor: Editor
 *         Windows: Windows
 *       second:
 *         enabled: 1
 *         settings:
 *           DefaultValueInitialized: true
 *           Exclude Editor: 0
 *           Exclude Linux64: 1
 *           Exclude OSXUniversal: 1
 *           Exclude Win: 0
 *           Exclude Win64: 0
 *           OS: Windows
 */
interface PlatformDataEntry {
  first?: { Editor?: string; [key: string]: unknown };
  second?: { enabled?: unknown; settings?: { OS?: string; [key: string]: unknown } };
}

function isWindowsOnlyEditorEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;

  const { first, second } = entry as PlatformDataEntry;
  if (!first || first.Editor !== 'Editor') return false;
  if (!second) return false;

  const enabled = second.enabled;
  const isEnabled = enabled === 1 || enabled === '1' || enabled === true;
  if (!isEnabled) return false;

  return second.settings?.OS === 'Windows';
}

/**
 * Best-effort heuristic scan, not strict validation - .meta files can have
 * all kinds of importer types, and this only cares about the one specific
 * PluginImporter shape described above. Anything that doesn't parse or
 * doesn't match is silently skipped rather than thrown from.
 */
function parseMetaFile(metaFilePath: string): { guid?: string } | null {
  let content: string;
  try {
    content = fs.readFileSync(metaFilePath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(content);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const pluginImporter = (parsed as Record<string, unknown>).PluginImporter;
  if (!pluginImporter || typeof pluginImporter !== 'object') return null;

  const platformData = (pluginImporter as Record<string, unknown>).platformData;
  if (!Array.isArray(platformData)) return null;

  const isWindowsOnlyEditor = platformData.some(isWindowsOnlyEditorEntry);
  if (!isWindowsOnlyEditor) return null;

  const guid = (parsed as Record<string, unknown>).guid;
  return { guid: typeof guid === 'string' ? guid : undefined };
}

function findDllMetaFiles(dir: string): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDllMetaFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.dll.meta')) {
      results.push(entryPath);
    }
  }

  return results;
}

/**
 * Scans <projectPath>/Assets for .dll.meta files whose PluginImporter
 * restricts Editor availability to Windows-hosted editors only (see
 * WindowsOnlyEditorPlugin doc). Used to warn (never fail) before a build
 * that will run inside a Linux Docker container, where such a plugin is
 * invisible to the Editor entirely - not just excluded from the built
 * player - which can silently break compilation of any code that
 * references it unconditionally.
 */
export function scanForWindowsOnlyEditorPlugins(projectPath: string): WindowsOnlyEditorPlugin[] {
  const assetsDir = path.join(projectPath, 'Assets');
  const metaFiles = findDllMetaFiles(assetsDir);

  const flagged: WindowsOnlyEditorPlugin[] = [];
  for (const metaFilePath of metaFiles) {
    const result = parseMetaFile(metaFilePath);
    if (!result) continue;

    // Strip the trailing .meta to report the plugin's own (non-meta) path.
    const dllPath = metaFilePath.slice(0, -'.meta'.length);
    const relativePath = path.relative(projectPath, dllPath).split(path.sep).join('/');

    flagged.push({ path: relativePath, guid: result.guid });
  }

  return flagged;
}
