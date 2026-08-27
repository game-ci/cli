import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseSteamCmdOutput, type SteamCmdParseResult } from "./parse-steamcmd-output";

export interface RunSteamCmdOptions {
  /** Directory containing manifest.vdf and the depot VDF(s), already patched with correct ContentRoot/BuildOutput. */
  buildDir: string;
  username: string;
  password: string;
  /** 'local' runs steamcmd directly; 'docker' runs it via the cm2network/steamcmd image; 'auto' picks whichever is available, preferring local. */
  mode: "auto" | "local" | "docker";
  /** Explicit path to steamcmd's executable. Skips PATH/common-location auto-detection when set - recommended for CI determinism. */
  steamCmdPath?: string;
  /** Host directory containing Steam's own config.vdf, mounted into the Docker container so login sessions persist across runs. */
  steamConfigDir?: string;
  /**
   * Steam Guard TOTP code, passed to steamcmd via +set_steam_guard_code.
   * Mutually exclusive with configVdfBase64 in practice (steam-deploy's own
   * action treats them that way too - "If set, configVdf will be
   * ignored.") - if both are given, totp takes priority.
   */
  totp?: string;
  /**
   * Base64-encoded contents of Steam's own config/config.vdf, written to
   * steamHome/config/config.vdf before login so a previously-authorized
   * session (SteamGuard already completed once, outside CI) can be reused
   * without a TOTP code on every run. Ignored when totp is set.
   */
  configVdfBase64?: string;
  /** Directory steamcmd treats as its home (holds config/, logs/, etc). Defaults to $STEAM_HOME or ~/Steam, matching steam-deploy's own default. */
  steamHome?: string;
}

type SpawnFn = typeof spawn;

const LOCAL_STEAMCMD_CANDIDATES =
  process.platform === "win32"
    ? ["C:\\steamcmd\\steamcmd.exe", "C:\\Steam\\steamcmd.exe", "C:\\Program Files (x86)\\Steam\\steamcmd.exe"]
    : ["/usr/games/steamcmd", "/usr/bin/steamcmd", `${process.env.HOME}/steamcmd/steamcmd.sh`];

function findLocalSteamCmd(explicitPath?: string): string | null {
  if (explicitPath) return fs.existsSync(explicitPath) ? explicitPath : null;
  return LOCAL_STEAMCMD_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function resolveSteamHome(explicit?: string): string {
  return explicit ?? process.env.STEAM_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "Steam");
}

/**
 * Writes a base64-encoded config.vdf to steamHome/config/config.vdf, if
 * given - lets a session authorized once (outside CI, where an interactive
 * SteamGuard prompt is possible) be reused on every subsequent run without
 * a fresh TOTP code. Ported from steam-deploy's own bash implementation.
 */
function writeConfigVdfIfProvided(steamHome: string, configVdfBase64?: string): void {
  if (!configVdfBase64) return;

  const configDir = path.join(steamHome, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "config.vdf"), Buffer.from(configVdfBase64, "base64"));
}

function loginArgs(options: RunSteamCmdOptions): string[] {
  // set_steam_guard_code must precede +login for steamcmd to associate it
  // with that login attempt.
  return options.totp ? ["+set_steam_guard_code", options.totp, "+login", options.username, options.password] : ["+login", options.username, options.password];
}

function runProcess(spawnFn: SpawnFn, command: string, args: string[]): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk.toString()));
    child.stderr?.on("data", (chunk) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ output, exitCode: exitCode ?? 1 }));
  });
}

export class SteamCmdRunner {
  constructor(private readonly spawnFn: SpawnFn = spawn) {}

  async run(options: RunSteamCmdOptions): Promise<SteamCmdParseResult> {
    const localPath = findLocalSteamCmd(options.steamCmdPath);
    const useDocker = options.mode === "docker" || (options.mode === "auto" && !localPath);

    if (useDocker) {
      return this.runInDocker(options);
    }

    if (!localPath) {
      throw new Error(
        "steamcmd was not found locally (checked --steamCmdPath and common install locations). " +
          "Pass --steamCmdPath explicitly, or use --mode=docker.",
      );
    }

    writeConfigVdfIfProvided(resolveSteamHome(options.steamHome), options.totp ? undefined : options.configVdfBase64);

    const manifestPath = `${options.buildDir}/manifest.vdf`.replace(/\\/g, "/");
    const { output, exitCode } = await runProcess(this.spawnFn, localPath, [
      ...loginArgs(options),
      "+run_app_build",
      manifestPath,
      "+quit",
    ]);

    return parseSteamCmdOutput(output, exitCode);
  }

  private async runInDocker(options: RunSteamCmdOptions): Promise<SteamCmdParseResult> {
    const dockerArgs = ["run", "--rm", "-v", `${options.buildDir}:/build`];

    if (options.steamConfigDir) {
      dockerArgs.push("-v", `${options.steamConfigDir}:/home/steam/Steam`);
    } else if (!options.totp && options.configVdfBase64) {
      // No mounted config dir was given, but a config.vdf was - write it to
      // a real host directory and mount that, so it's actually visible
      // inside the container (writing to resolveSteamHome() alone would
      // land on the host filesystem, not the container's).
      const steamHome = resolveSteamHome(options.steamHome);
      writeConfigVdfIfProvided(steamHome, options.configVdfBase64);
      dockerArgs.push("-v", `${steamHome}:/home/steam/Steam`);
    }

    dockerArgs.push(
      "cm2network/steamcmd:latest",
      "/home/steam/steamcmd/steamcmd.sh",
      ...loginArgs(options),
      "+run_app_build",
      "/build/manifest.vdf",
      "+quit",
    );

    const { output, exitCode } = await runProcess(this.spawnFn, "docker", dockerArgs);

    return parseSteamCmdOutput(output, exitCode);
  }
}
