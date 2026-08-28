import * as fs from "node:fs";
import * as path from "node:path";
import { generateAppVdf, generateDepotVdf } from "./vdf-generator";
import { SteamCmdRunner } from "./steamcmd-runner";

const MAX_EXTRA_DEPOTS = 9;

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
  debugBranch?: boolean;
  /**
   * When additional depots are used (depotNPath), the first extra depot ID
   * defaults to depotId+1, depotId+2, ... . Set this to override where that
   * sequence starts - matches steam-deploy's own firstDepotIdOverride input.
   */
  firstDepotIdOverride?: string;
  depotPath?: string;
  depotInstallScriptPath?: string;
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
      })
      .option("debugBranch", {
        describe: "Ship debug symbols (*.pdb, Burst debug/backup folders) instead of excluding them.",
        type: "boolean",
        default: false,
      })
      .option("firstDepotIdOverride", {
        describe:
          "Depot ID to start numbering extra depots (depot1Path..depot9Path) from. Defaults to depotId+1, depotId+2, ...",
        type: "string",
      })
      .option("depotPath", {
        describe: "Path (relative to the build) mapped by the primary --depotId depot. Defaults to the whole build.",
        type: "string",
      })
      .option("depotInstallScriptPath", {
        describe: "Install script (relative to the primary depot's content) to run after it installs.",
        type: "string",
      });

    for (let index = 1; index <= MAX_EXTRA_DEPOTS; index++) {
      yargs
        .option(`depot${index}Path`, {
          describe: `Path (relative to the build) mapped by extra depot #${index}, beyond the primary --depotId depot.`,
          type: "string",
        })
        .option(`depot${index}InstallScriptPath`, {
          describe: `Install script (relative to extra depot #${index}'s content) to run after it installs.`,
          type: "string",
        });
    }
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
    const includeDebugSymbols = options.debugBranch ?? false;

    const absoluteBuildPath = path.resolve(buildPath);
    const contentRoot = mode === "docker" ? "/build" : absoluteBuildPath.replace(/\\/g, "/");

    const extraDepots = this.collectExtraDepots(options, depotId);
    const primaryLocalPath = options.depotPath ? `./${options.depotPath.replace(/^\.?\/*/, "")}/*` : undefined;
    const allDepots = [
      { depotId, localPath: primaryLocalPath, installScript: options.depotInstallScriptPath },
      ...extraDepots,
    ];

    const depotEntries = allDepots.map((depot) => ({
      depotId: depot.depotId,
      vdfFileName: `depot_build_${depot.depotId}.vdf`,
    }));

    for (const depot of allDepots) {
      const depotVdf = generateDepotVdf({
        depotId: depot.depotId,
        localPath: depot.localPath,
        installScript: depot.installScript,
        extraExclusions: depot.depotId === depotId ? extraExclusions : undefined,
        includeDebugSymbols,
      });
      fs.writeFileSync(path.join(absoluteBuildPath, `depot_build_${depot.depotId}.vdf`), depotVdf, "utf8");
    }

    const appVdf = generateAppVdf({ appId, depots: depotEntries, branch, description })
      // generateAppVdf's contentroot/buildoutput default to "./" - override to
      // the path the running steamcmd process will actually see (an absolute
      // host path for local mode, or the container mount point for docker).
      .replace('"contentroot" "./"', `"contentroot" "${contentRoot}"`)
      .replace('"buildoutput" "./"', `"buildoutput" "${contentRoot}"`);

    fs.writeFileSync(path.join(absoluteBuildPath, "manifest.vdf"), appVdf, "utf8");

    const depotIdList = depotEntries.map((d) => d.depotId).join(", ");
    console.log(`Deploying ${absoluteBuildPath} to Steam app ${appId}, depot(s) ${depotIdList}, branch "${branch}"`);

    // Steam Guard TOTP and a pre-authorized config.vdf are both credentials -
    // env vars only, never CLI arguments (argv can leak through process listings).
    const runner = new SteamCmdRunner();
    const result = await runner.run({
      buildDir: absoluteBuildPath,
      username,
      password,
      mode,
      steamCmdPath: options.steamCmdPath,
      steamConfigDir: options.steamConfigDir,
      totp: process.env.STEAM_TOTP,
      configVdfBase64: process.env.STEAM_CONFIG_VDF_BASE64,
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

  /**
   * Reads depot1Path..depot9Path (+ matching depot{n}InstallScriptPath) and
   * assigns each a sequential depot ID after the primary --depotId, starting
   * from --firstDepotIdOverride if given - matches steam-deploy's own
   * up-to-9-extra-depots convention.
   */
  private collectExtraDepots(
    options: SteamDeployOptions,
    primaryDepotId: string,
  ): Array<{ depotId: string; localPath: string; installScript?: string }> {
    const firstExtraId = options.firstDepotIdOverride
      ? Number.parseInt(options.firstDepotIdOverride, 10)
      : Number.parseInt(primaryDepotId, 10) + 1;

    const extras: Array<{ depotId: string; localPath: string; installScript?: string }> = [];
    for (let index = 1; index <= MAX_EXTRA_DEPOTS; index++) {
      const localPath = options[`depot${index}Path`] as string | undefined;
      if (!localPath) continue;

      extras.push({
        depotId: String(firstExtraId + extras.length),
        localPath: `./${localPath.replace(/^\.?\/*/, "")}/*`,
        installScript: options[`depot${index}InstallScriptPath`] as string | undefined,
      });
    }
    return extras;
  }
}
