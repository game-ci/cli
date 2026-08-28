import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { parseWorkshopOutput, type WorkshopParseResult } from "./parse-workshop-output";

export interface RunWorkshopUploadOptions {
  /**
   * Directory containing both the prepared workshop_build_item.vdf and
   * the item's own content - mounted as a whole in Docker mode (matching
   * steam-deploy's buildDir mount) so relative contentfolder/previewfile
   * paths inside the VDF resolve the same way whether steamcmd runs on
   * the host or in the container.
   */
  workDir: string;
  /** VDF file name, relative to workDir. */
  vdfFileName: string;
  username: string;
  password: string;
  mode: "auto" | "local" | "docker";
  steamCmdPath?: string;
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

/**
 * Runs `steamcmd +login <user> <pass> +workshop_build_item <vdfPath> +quit`.
 *
 * This duplicates steam-deploy's own local/Docker execution shape rather
 * than reusing SteamCmdRunner directly - that class is hardcoded to the
 * appbuild.vdf/+run_app_build flow, and it isn't exported in a form this
 * package can drive with a different SteamCMD subcommand. Extracting a
 * shared base once both packages' real usage patterns are settled is
 * flagged as a follow-up in the README, not attempted here.
 */
export class WorkshopCmdRunner {
  constructor(private readonly spawnFn: SpawnFn = spawn) {}

  async upload(options: RunWorkshopUploadOptions): Promise<WorkshopParseResult> {
    const localPath = findLocalSteamCmd(options.steamCmdPath);
    const useDocker = options.mode === "docker" || (options.mode === "auto" && !localPath);

    if (useDocker) {
      const containerWorkDir = "/build";
      const loginArgs = [
        "+login",
        options.username,
        options.password,
        "+workshop_build_item",
        `${containerWorkDir}/${options.vdfFileName}`,
        "+quit",
      ];
      const dockerArgs = [
        "run",
        "--rm",
        "-v",
        `${options.workDir}:${containerWorkDir}`,
        "cm2network/steamcmd:latest",
        "/home/steam/steamcmd/steamcmd.sh",
        ...loginArgs,
      ];
      const { output, exitCode } = await runProcess(this.spawnFn, "docker", dockerArgs);
      return parseWorkshopOutput(output, exitCode);
    }

    if (!localPath) {
      throw new Error(
        "steamcmd was not found locally (checked --steamCmdPath and common install locations). " +
          "Pass --steamCmdPath explicitly, or use --mode=docker.",
      );
    }

    const vdfPath = `${options.workDir}/${options.vdfFileName}`.replace(/\\/g, "/");
    const loginArgs = ["+login", options.username, options.password, "+workshop_build_item", vdfPath, "+quit"];
    const { output, exitCode } = await runProcess(this.spawnFn, localPath, loginArgs);
    return parseWorkshopOutput(output, exitCode);
  }
}
