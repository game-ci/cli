/**
 * Generates SteamCMD's VDF (Valve Data Format) files: the app build
 * manifest and one depot definition per depot. Ported from a real,
 * production PowerShell script (BuildVdfFiles.ps1) - the file-exclusion
 * list in particular reflects real hard-won Unity-build knowledge (Burst
 * debug info and backup folders that shouldn't ship to Steam) - and from
 * game-ci/steam-deploy's own multi-depot bash implementation, for parity
 * with the up-to-9-depots-per-app support that action shipped.
 */

export interface FileMappingOption {
  /** Relative path to the depot's content root; may contain wildcards ("?", "*"). */
  localPath: string;
  /** Where matched files land inside the depot. Defaults to "." - the depot root. */
  depotPath?: string;
  /** Whether the mapping also applies to matching files in subfolders. Defaults to true. */
  recursive?: boolean;
}

export interface FilePropertyOption {
  /** Path (relative to the depot's content root) of the file this property applies to. */
  localPath: string;
  /**
   * "userconfig": file is modified by the user/game - never overwritten by an
   * update, and a local diff from the shipped version isn't a verification
   * error. "versionedconfig": same, but Steam re-applies the depot's version
   * locally when the file itself changes in an update.
   */
  attribute: "userconfig" | "versionedconfig";
}

export interface DepotVdfOptions {
  depotId: string;
  /**
   * Path (relative to the depot's own working directory) SteamCMD maps this
   * depot's files from. Defaults to "./*" - the whole build. Ignored when
   * fileMappings is given; kept as a shorthand for the common single-mapping
   * case.
   */
  localPath?: string;
  /**
   * Explicit FileMapping blocks, for depots that need more than one -
   * SteamCMD depots support multiple mappings with independent
   * localPath/depotPath/recursive settings (see game-ci/steam-deploy#67).
   * Overrides localPath when set.
   */
  fileMappings?: FileMappingOption[];
  /** FileProperties blocks - marks specific files as user-modifiable/versioned config (see game-ci/steam-deploy#67). */
  fileProperties?: FilePropertyOption[];
  /** Path to an install script (relative to the depot's content) to run after this depot installs. */
  installScript?: string;
  /** Glob-style exclusion patterns, e.g. "*.pdb". Applied in addition to the built-in defaults. */
  extraExclusions?: string[];
  /**
   * When true, ships debug symbols/directories instead of excluding them -
   * matches game-ci/steam-deploy's own `debugBranch` input. Defaults to
   * false (exclude them), the safer default for a release build.
   */
  includeDebugSymbols?: boolean;
}

const ALWAYS_EXCLUDED = ["*.log", "*.vdf"];

const DEBUG_SYMBOL_EXCLUSIONS = [
  "*.pdb",
  "*_BurstDebugInformation_DoNotShip*",
  "*_BackUpThisFolder_ButDontShipItWithYourGame*",
];

function formatFileMapping(mapping: FileMappingOption): string {
  return [
    '    "FileMapping"',
    "    {",
    `        "LocalPath"\t"${mapping.localPath}"`,
    `        "DepotPath"\t"${mapping.depotPath ?? "."}"`,
    `        "recursive"\t"${mapping.recursive === false ? "0" : "1"}"`,
    "    }",
  ].join("\n");
}

function formatFileProperty(property: FilePropertyOption): string {
  return [
    '    "FileProperties"',
    "    {",
    `        "LocalPath"\t"${property.localPath}"`,
    `        "Attributes"\t"${property.attribute}"`,
    "    }",
  ].join("\n");
}

export function generateDepotVdf(options: DepotVdfOptions): string {
  const exclusions = [
    ...ALWAYS_EXCLUDED,
    ...(options.includeDebugSymbols ? [] : DEBUG_SYMBOL_EXCLUSIONS),
    ...(options.extraExclusions ?? []),
  ];
  const exclusionLines = exclusions.map((pattern) => `    "FileExclusion"\t"${pattern}"`).join("\n");

  const mappings = options.fileMappings ?? [{ localPath: options.localPath ?? "./*", depotPath: ".", recursive: true }];
  const mappingLines = mappings.map(formatFileMapping).join("\n");
  const propertyLines = (options.fileProperties ?? []).map(formatFileProperty).join("\n");

  return [
    '"DepotBuildConfig"',
    "{",
    `    "depotid" "${options.depotId}"`,
    mappingLines,
    exclusionLines,
    ...(propertyLines ? [propertyLines] : []),
    ...(options.installScript ? [`    "InstallScript" "${options.installScript}"`] : []),
    "}",
  ].join("\n");
}

export interface AppVdfDepotEntry {
  depotId: string;
  vdfFileName: string;
}

export interface AppVdfOptions {
  appId: string;
  /** One or more depots to include in the build - see game-ci/cli#212's multi-depot support. */
  depots: AppVdfDepotEntry[];
  /** Steam branch to publish to (Steam's "setlive" field), e.g. "default", "beta". */
  branch: string;
  /** Human-readable build description shown in the Steam build history. */
  description: string;
}

export function generateAppVdf(options: AppVdfOptions): string {
  if (options.depots.length === 0) {
    throw new Error("generateAppVdf requires at least one depot");
  }

  const depotLines = options.depots
    .map((depot) => `        "${depot.depotId}" "${depot.vdfFileName}"`)
    .join("\n");

  return [
    '"appbuild"',
    "{",
    `    "appid" "${options.appId}"`,
    `    "desc" "${options.description}"`,
    '    "contentroot" "./"',
    '    "buildoutput" "./"',
    `    "setlive" "${options.branch}"`,
    '    "depots"',
    "    {",
    depotLines,
    "    }",
    "}",
  ].join("\n");
}
