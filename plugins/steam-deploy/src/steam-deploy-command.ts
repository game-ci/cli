import * as fs from "node:fs";
import * as path from "node:path";
import { generateAppVdf, generateDepotVdf } from "./vdf-generator";
import { SteamCmdRunner } from "./steamcmd-runner";

export interface SteamDeployOptions {
  buildPath?: string;
  appId?: string;
  depotId?: string;
  branch?: string;
  description?: string;
  mode?: string;
  steamCmdPath?: string;
  steamConfigDir?: string;
  extraExclusions?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

export class SteamDeployCommand {
  public readonly name = "Deploy steam";

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("appId", {
        describe: "Steam App ID",
        type: "string",
        demandOption: true,
      })
      .option("depotId", {
        describe: "Steam Depot ID",
        type: "string",
        demandOption: true,
      })
      .option("branch", {
        describe: 'Steam branch to publish to (SteamCMD\'s "setlive" field)',
        type: "string",
        default: "default",
      })
      .option("description", {
        describe:
          "Build description shown in the Steam build history. Defaults to the branch name and current timestamp.",
        type: "string",
      })
      .option("mode", {
        describe: "How to run steamcmd: auto (default), local, or docker",
        type: "string",
        default: "auto",
      })
      .option("steamCmdPath", {
        describe: "Explicit path to the steamcmd executable. Recommended for CI determinism; skips auto-detection.",
        type: "string",
      })
      .option("steamConfigDir", {
        describe:
          "Host directory containing Steam's config.vdf, mounted into the container in docker mode so login sessions persist.",
        type: "string",
      })
      .option("extraExclusions", {
        describe:
          "Comma-separated extra file-exclusion glob patterns for the depot, beyond the built-in defaults (*.pdb, *.log, *.vdf, Burst debug/backup folders).",
        type: "string",
      });
  }

  public async execute(options: SteamDeployOptions): Promise<boolean> {
    const buildPath = options.buildPath;
    if (!buildPath) {
      throw new Error("A build path is required: game-ci deploy steam <buildPath>");
    }
    if (!fs.existsSync(buildPath)) {
      throw new Error(`Build path does not exist: ${buildPath}`);
    }

    const username = process.env.STEAM_USERNAME;
    const password = process.env.STEAM_PASSWORD;
    if (!username || !password) {
      throw new Error(
        "STEAM_USERNAME and STEAM_PASSWORD must be set as environment variables (never as CLI arguments - argv can leak through process listings).",
      );
    }

    const appId = options.appId!;
    const depotId = options.depotId!;
    const branch = options.branch ?? "default";
    const description = options.description ?? `${branch} build ${new Date().toISOString()}`;
    const mode = (options.mode ?? "auto") as "auto" | "local" | "docker";
    const extraExclusions = options.extraExclusions
      ? options.extraExclusions.split(",").map((s) => s.trim())
      : undefined;

    const absoluteBuildPath = path.resolve(buildPath);
    const contentRoot = mode === "docker" ? "/build" : absoluteBuildPath.replace(/\\/g, "/");
    const depotFileName = `depot_build_${depotId}.vdf`;

    const depotVdf = generateDepotVdf({ depotId, extraExclusions });
    const appVdf = generateAppVdf({ appId, depotId, branch, description, depotVdfFileName: depotFileName })
      // generateAppVdf's contentroot/buildoutput default to "./" - override to
      // the path the running steamcmd process will actually see (an absolute
      // host path for local mode, or the container mount point for docker).
      .replace('"contentroot" "./"', `"contentroot" "${contentRoot}"`)
      .replace('"buildoutput" "./"', `"buildoutput" "${contentRoot}"`);

    fs.writeFileSync(path.join(absoluteBuildPath, depotFileName), depotVdf, "utf8");
    fs.writeFileSync(path.join(absoluteBuildPath, "manifest.vdf"), appVdf, "utf8");

    console.log(`Deploying ${absoluteBuildPath} to Steam app ${appId}, depot ${depotId}, branch "${branch}"`);

    const runner = new SteamCmdRunner();
    const result = await runner.run({
      buildDir: absoluteBuildPath,
      username,
      password,
      mode,
      steamCmdPath: options.steamCmdPath,
      steamConfigDir: options.steamConfigDir,
    });

    if (!result.success) {
      throw new Error(`Steam deployment failed: ${result.failureReason}`);
    }

    if (result.buildId) {
      console.log(`Steam deployment succeeded. BuildID: ${result.buildId}`);
    } else {
      console.log("Steam deployment succeeded (no BuildID found in output).");
    }

    return true;
  }
}
