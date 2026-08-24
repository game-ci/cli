import { spawn } from "node:child_process";
import * as fs from "node:fs";
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

    const manifestPath = `${options.buildDir}/manifest.vdf`.replace(/\\/g, "/");
    const { output, exitCode } = await runProcess(this.spawnFn, localPath, [
      "+login",
      options.username,
      options.password,
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
    }

    dockerArgs.push(
      "cm2network/steamcmd:latest",
      "/home/steam/steamcmd/steamcmd.sh",
      "+login",
      options.username,
      options.password,
      "+run_app_build",
      "/build/manifest.vdf",
      "+quit",
    );

    const { output, exitCode } = await runProcess(this.spawnFn, "docker", dockerArgs);

    return parseSteamCmdOutput(output, exitCode);
  }
}
