/**
 * Generates SteamCMD's two VDF (Valve Data Format) files: the app build
 * manifest and a depot definition. Ported from a real, production
 * PowerShell script (BuildVdfFiles.ps1) - the file-exclusion list in
 * particular reflects real hard-won Unity-build knowledge (Burst debug
 * info and backup folders that shouldn't ship to Steam).
 */

export interface DepotVdfOptions {
  depotId: string;
  /** Glob-style exclusion patterns, e.g. "*.pdb". Applied in addition to the built-in defaults. */
  extraExclusions?: string[];
}

const DEFAULT_EXCLUSIONS = [
  "*.pdb",
  "*.log",
  "*.vdf",
  "*_BurstDebugInformation_DoNotShip*",
  "*_BackUpThisFolder_ButDontShipItWithYourGame*",
];

export function generateDepotVdf(options: DepotVdfOptions): string {
  const exclusions = [...DEFAULT_EXCLUSIONS, ...(options.extraExclusions ?? [])];
  const exclusionLines = exclusions.map((pattern) => `    "FileExclusion"\t"${pattern}"`).join("\n");

  return [
    '"DepotBuildConfig"',
    "{",
    `    "depotid" "${options.depotId}"`,
    '    "FileMapping"',
    "    {",
    '        "LocalPath"\t"./*"',
    '        "DepotPath"\t"."',
    '        "recursive"\t"1"',
    "    }",
    exclusionLines,
    "}",
  ].join("\n");
}

export interface AppVdfOptions {
  appId: string;
  depotId: string;
  /** Steam branch to publish to (Steam's "setlive" field), e.g. "default", "beta". */
  branch: string;
  /** Human-readable build description shown in the Steam build history. */
  description: string;
  depotVdfFileName: string;
}

export function generateAppVdf(options: AppVdfOptions): string {
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
    `        "${options.depotId}" "${options.depotVdfFileName}"`,
    "    }",
    "}",
  ].join("\n");
}
