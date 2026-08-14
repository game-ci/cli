/**
 * Registry of Unity log/diagnostic paths across platforms.
 *
 * Used by UnityLogCollectorService to find Unity-internal logs that Unity
 * support frequently requests for troubleshooting (Editor.log, licensing
 * logs, audit logs, services-config.json, build reports, etc.).
 *
 * Paths are grouped by platform (linux/darwin/win32) and category. The
 * service expands env-var tokens (HOME, LOCALAPPDATA, APPDATA, PROGRAMDATA,
 * USERPROFILE) at runtime so the same registry serves all environments.
 *
 * Engine plugins for non-Unity engines may register their own diagnostic
 * paths in the future; this registry stays Unity-specific.
 */

export type UnityLogCategory =
  | 'editor-log'
  | 'editor-prev-log'
  | 'licensing-client'
  | 'entitlements-audit'
  | 'services-config'
  | 'unity-hub-info'
  | 'unity-hub-error'
  | 'editor-crash'
  | 'build-report'
  | 'bee-backend'
  | 'player-log'
  | 'test-results'
  | 'il2cpp-output'
  | 'license-file'
  | 'project-version'
  | 'package-manifest'
  | 'macos-crash-report'
  | 'windows-event-log';

export type UnityLogPlatform = 'linux' | 'darwin' | 'win32';

export interface UnityLogPathDefinition {
  /** Stable category identifier */
  category: UnityLogCategory;
  /** Human-readable description for manifests and docs */
  description: string;
  /**
   * Path templates per platform. Tokens supported:
   *   $HOME, $USERPROFILE, $LOCALAPPDATA, $APPDATA, $PROGRAMDATA,
   *   $PROJECT, $WORKSPACE, $UNITY_VERSION, $COMPANY, $GAME
   * A `*` in the path is treated as a glob match (single-segment).
   */
  paths: Partial<Record<UnityLogPlatform, string[]>>;
  /**
   * Whether this category should be considered sensitive (e.g. license file).
   * Sensitive categories are NOT collected unless `includeSensitive` is true.
   */
  sensitive?: boolean;
  /**
   * Whether the path is workspace-relative (rooted at the project) rather
   * than at a fixed OS location. Workspace-relative paths are always
   * available regardless of self-hosted vs containerised runners.
   */
  workspaceRelative?: boolean;
  /** Whether the path is a directory whose contents should be copied recursively */
  isDirectory?: boolean;
  /**
   * Optional Windows PowerShell command to capture (e.g. Get-WinEvent).
   * Output is captured into a `<category>.txt` file in the artifact dir.
   */
  windowsCommand?: string;
}

export const UNITY_LOG_PATHS: UnityLogPathDefinition[] = [
  {
    category: 'editor-log',
    description: 'Unity Editor.log — primary build/import/compile log',
    paths: {
      linux: ['$HOME/.config/unity3d/Editor.log'],
      darwin: ['$HOME/Library/Logs/Unity/Editor.log'],
      win32: ['$LOCALAPPDATA/Unity/Editor/Editor.log'],
    },
  },
  {
    category: 'editor-prev-log',
    description: 'Previous Unity Editor.log (rotated on next launch)',
    paths: {
      linux: ['$HOME/.config/unity3d/Editor-prev.log'],
      darwin: ['$HOME/Library/Logs/Unity/Editor-prev.log'],
      win32: ['$LOCALAPPDATA/Unity/Editor/Editor-prev.log'],
    },
  },
  {
    category: 'licensing-client',
    description: 'Unity Licensing Client log',
    paths: {
      linux: ['$HOME/.config/unity3d/Unity/Unity.Licensing.Client.log'],
      darwin: ['$HOME/Library/Logs/Unity/Unity.Licensing.Client.log'],
      win32: ['$LOCALAPPDATA/Unity/Unity.Licensing.Client.log'],
    },
  },
  {
    category: 'entitlements-audit',
    description: 'Unity Entitlements/Licensing audit log',
    paths: {
      linux: ['$HOME/.config/unity3d/Unity/Unity.Entitlements.Audit.log'],
      darwin: ['$HOME/Library/Logs/Unity/Unity.Entitlements.Audit.log'],
      win32: ['$LOCALAPPDATA/Unity/Unity.Entitlements.Audit.log'],
    },
  },
  {
    category: 'services-config',
    description: 'Unity services-config.json (license server / Hub config)',
    paths: {
      linux: ['/usr/share/unity3d/config/services-config.json'],
      darwin: ['/Library/Application Support/Unity/config/services-config.json'],
      win32: ['$PROGRAMDATA/Unity/config/services-config.json'],
    },
  },
  {
    category: 'unity-hub-info',
    description: 'Unity Hub info-log.json',
    paths: {
      linux: ['$HOME/.config/UnityHub/logs/info-log.json'],
      darwin: ['$HOME/Library/Application Support/UnityHub/logs/info-log.json'],
      win32: ['$APPDATA/UnityHub/logs/info-log.json'],
    },
  },
  {
    category: 'unity-hub-error',
    description: 'Unity Hub error-log.json',
    paths: {
      linux: ['$HOME/.config/UnityHub/logs/error-log.json'],
      darwin: ['$HOME/Library/Application Support/UnityHub/logs/error-log.json'],
      win32: ['$APPDATA/UnityHub/logs/error-log.json'],
    },
  },
  {
    category: 'editor-crash',
    description: 'Editor crash dumps directory',
    isDirectory: true,
    paths: {
      linux: ['$HOME/.config/unity3d/Crashes'],
      darwin: ['$HOME/Library/Logs/Unity/Crashes'],
      win32: ['$LOCALAPPDATA/Unity/Editor/Crash'],
    },
  },
  {
    category: 'build-report',
    description: 'LastBuild.buildreport (binary, opens in Unity Build Profiler)',
    workspaceRelative: true,
    paths: {
      linux: ['$PROJECT/Library/LastBuild.buildreport'],
      darwin: ['$PROJECT/Library/LastBuild.buildreport'],
      win32: ['$PROJECT/Library/LastBuild.buildreport'],
    },
  },
  {
    category: 'bee-backend',
    description: 'Bee build backend log (incremental build pipeline)',
    workspaceRelative: true,
    paths: {
      linux: ['$PROJECT/Library/Bee/bee_backend.log'],
      darwin: ['$PROJECT/Library/Bee/bee_backend.log'],
      win32: ['$PROJECT/Library/Bee/bee_backend.log'],
    },
  },
  {
    category: 'player-log',
    description: 'Player.log (runtime log when running the built player)',
    paths: {
      linux: ['$HOME/.config/unity3d/*/Player.log'],
      darwin: ['$HOME/Library/Logs/*/Player.log'],
      win32: ['$USERPROFILE/AppData/LocalLow/*/Player.log'],
    },
  },
  {
    category: 'test-results',
    description: 'Unity test runner XML results',
    workspaceRelative: true,
    isDirectory: true,
    paths: {
      linux: ['$PROJECT/TestResults', '$WORKSPACE/test-results'],
      darwin: ['$PROJECT/TestResults', '$WORKSPACE/test-results'],
      win32: ['$PROJECT/TestResults', '$WORKSPACE/test-results'],
    },
  },
  {
    category: 'il2cpp-output',
    description: 'IL2CPP staging area (C++ generated by IL2CPP)',
    workspaceRelative: true,
    isDirectory: true,
    paths: {
      linux: ['$PROJECT/Temp/StagingArea/Data/il2cppOutput'],
      darwin: ['$PROJECT/Temp/StagingArea/Data/il2cppOutput'],
      win32: ['$PROJECT/Temp/StagingArea/Data/il2cppOutput'],
    },
  },
  {
    category: 'license-file',
    description: 'Unity license file (.ulf) — SENSITIVE, opt-in',
    sensitive: true,
    paths: {
      linux: ['/etc/unity3d/Unity_v2*.ulf', '/usr/share/unity3d/config/Unity_lic.ulf'],
      darwin: ['/Library/Application Support/Unity/Unity_v2*.ulf'],
      win32: ['$PROGRAMDATA/Unity/Unity_lic.ulf', '$PROGRAMDATA/Unity/Unity_v2*.ulf'],
    },
  },
  {
    category: 'project-version',
    description: 'ProjectVersion.txt (Unity editor version)',
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
  {
    category: 'macos-crash-report',
    description: 'macOS crash report (DiagnosticReports)',
    paths: {
      darwin: ['$HOME/Library/Logs/DiagnosticReports/Unity-*.crash'],
    },
  },
  {
    category: 'windows-event-log',
    description: 'Windows Event Log slice (Unity provider) — captured via Get-WinEvent',
    paths: {
      win32: [],
    },
    windowsCommand:
      "Get-WinEvent -ProviderName 'Unity' -ErrorAction SilentlyContinue | Select-Object -First 200 TimeCreated, LevelDisplayName, ProviderName, Id, Message | Format-List",
  },
];

const BUILT_IN_BY_CATEGORY: Record<UnityLogCategory, UnityLogPathDefinition> =
  UNITY_LOG_PATHS.reduce(
    (acc, def) => {
      acc[def.category] = def;
      return acc;
    },
    {} as Record<UnityLogCategory, UnityLogPathDefinition>,
  );

export function getUnityLogPath(category: UnityLogCategory): UnityLogPathDefinition | undefined {
  return BUILT_IN_BY_CATEGORY[category];
}

export function listAllUnityLogCategories(): UnityLogCategory[] {
  return UNITY_LOG_PATHS.map((d) => d.category);
}

export function listSafeUnityLogCategories(): UnityLogCategory[] {
  return UNITY_LOG_PATHS.filter((d) => !d.sensitive).map((d) => d.category);
}
