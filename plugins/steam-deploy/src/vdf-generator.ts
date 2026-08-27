/**
 * Generates SteamCMD's VDF (Valve Data Format) files: the app build
 * manifest and one depot definition per depot. Ported from a real,
 * production PowerShell script (BuildVdfFiles.ps1) - the file-exclusion
 * list in particular reflects real hard-won Unity-build knowledge (Burst
 * debug info and backup folders that shouldn't ship to Steam) - and from
 * game-ci/steam-deploy's own multi-depot bash implementation, for parity
 * with the up-to-9-depots-per-app support that action shipped.
 */

export interface DepotVdfOptions {
  depotId: string;
  /** Path (relative to the depot's own working directory) SteamCMD maps this depot's files from. Defaults to "./*" - the whole build. */
  localPath?: string;
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

export function generateDepotVdf(options: DepotVdfOptions): string {
  const exclusions = [
    ...ALWAYS_EXCLUDED,
    ...(options.includeDebugSymbols ? [] : DEBUG_SYMBOL_EXCLUSIONS),
    ...(options.extraExclusions ?? []),
  ];
  const exclusionLines = exclusions.map((pattern) => `    "FileExclusion"\t"${pattern}"`).join("\n");

  return [
    '"DepotBuildConfig"',
    "{",
    `    "depotid" "${options.depotId}"`,
    '    "FileMapping"',
    "    {",
    `        "LocalPath"\t"${options.localPath ?? "./*"}"`,
    '        "DepotPath"\t"."',
    '        "recursive"\t"1"',
    "    }",
    exclusionLines,
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
