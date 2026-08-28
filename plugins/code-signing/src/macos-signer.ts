import { spawn } from "node:child_process";

type SpawnFn = typeof spawn;

export interface MacosSignOptions {
  /** Path to the built .app bundle. */
  appPath: string;
  /** Code signing identity, e.g. "Developer ID Application: Studio Name (TEAMID)". */
  identity: string;
  /** Path to an entitlements .plist, if the app needs any (e.g. hardened runtime exceptions). */
  entitlementsPath?: string;
}

export interface NotarizeOptions {
  /** Path to the zip/dmg/pkg submitted for notarization - notarytool doesn't accept a raw .app bundle. */
  archivePath: string;
  appleId: string;
  teamId: string;
  /** An App Store Connect app-specific password (not the Apple ID's own account password). */
  appSpecificPassword: string;
}

export interface RunResult {
  success: boolean;
  output: string;
  exitCode: number;
}

function runProcess(spawnFn: SpawnFn, command: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk.toString()));
    child.stderr?.on("data", (chunk) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ success: exitCode === 0, output, exitCode: exitCode ?? 1 }));
  });
}

export function codesignArgs(options: MacosSignOptions): string[] {
  const args = [
    "--deep",
    "--force",
    "--verify",
    "--verbose",
    "--sign",
    options.identity,
    // Required for notarization since macOS 10.15 - notarytool rejects
    // submissions without the hardened runtime enabled.
    "--options",
    "runtime",
  ];
  if (options.entitlementsPath) {
    args.push("--entitlements", options.entitlementsPath);
  }
  args.push(options.appPath);
  return args;
}

/** ditto -c -k --keepParent, per Apple's own documented notarization workflow: zips the .app while preserving its bundle structure (a plain `zip` can silently break bundle metadata that ditto preserves). */
export function dittoZipArgs(appPath: string, zipPath: string): string[] {
  return ["-c", "-k", "--keepParent", appPath, zipPath];
}

export function notarytoolSubmitArgs(options: NotarizeOptions): string[] {
  return [
    "notarytool",
    "submit",
    options.archivePath,
    "--apple-id",
    options.appleId,
    "--team-id",
    options.teamId,
    "--password",
    options.appSpecificPassword,
    "--wait",
  ];
}

export function staplerArgs(appPath: string): string[] {
  return ["stapler", "staple", appPath];
}

export class MacosSigner {
  constructor(private readonly spawnFn: SpawnFn = spawn) {}

  codesign(options: MacosSignOptions): Promise<RunResult> {
    return runProcess(this.spawnFn, "codesign", codesignArgs(options));
  }

  ditto(appPath: string, zipPath: string): Promise<RunResult> {
    return runProcess(this.spawnFn, "ditto", dittoZipArgs(appPath, zipPath));
  }

  notarize(options: NotarizeOptions): Promise<RunResult> {
    return runProcess(this.spawnFn, "xcrun", notarytoolSubmitArgs(options));
  }

  staple(appPath: string): Promise<RunResult> {
    return runProcess(this.spawnFn, "xcrun", staplerArgs(appPath));
  }
}
