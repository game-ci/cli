import * as fs from "node:fs";
import { ButlerRunner } from "./butler-runner";

export interface ItchDeployOptions {
  buildPath?: string;
  user?: string;
  game?: string;
  channel?: string;
  butlerPath?: string;
  userVersion?: string;
  ignore?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

export class ItchDeployCommand {
  public readonly name = "Deploy itch";

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("user", {
        describe: "itch.io username or organization.",
        type: "string",
        demandOption: true,
      })
      .option("game", {
        describe: "itch.io game slug.",
        type: "string",
        demandOption: true,
      })
      .option("channel", {
        describe: 'Channel to push to, e.g. "windows", "linux", "web".',
        type: "string",
        demandOption: true,
      })
      .option("butlerPath", {
        describe: "Explicit path to the butler executable. Recommended for CI determinism; defaults to resolving \"butler\" via PATH.",
        type: "string",
      })
      .option("userVersion", {
        describe: "Custom version string shown in itch.io's build history (butler's own --userversion).",
        type: "string",
      })
      .option("ignore", {
        describe: "Comma-separated glob patterns to exclude from the push.",
        type: "string",
      });
  }

  public async execute(options: ItchDeployOptions): Promise<boolean> {
    const buildPath = options.buildPath;
    if (!buildPath) {
      throw new Error("A build path is required: game-ci deploy itch <buildPath>");
    }
    if (!fs.existsSync(buildPath)) {
      throw new Error(`Build path does not exist: ${buildPath}`);
    }

    // Butler itself reads BUTLER_API_KEY from its own process environment
    // when present, skipping its normal interactive `butler login` flow -
    // documented itch.io CI convention, and consistent with this repo's
    // own credentials-as-env-vars-only rule (never CLI arguments - argv
    // can leak through process listings).
    if (!process.env.BUTLER_API_KEY) {
      throw new Error(
        "BUTLER_API_KEY must be set as an environment variable (never as a CLI argument - argv can leak through process listings).",
      );
    }

    const user = options.user!;
    const game = options.game!;
    const channel = options.channel!;
    const ignore = options.ignore ? options.ignore.split(",").map((pattern) => pattern.trim()) : undefined;

    console.log(`Deploying ${buildPath} to itch.io as ${user}/${game}:${channel}`);

    const runner = new ButlerRunner();
    const result = await runner.push({
      buildDir: buildPath,
      target: `${user}/${game}`,
      channel,
      butlerPath: options.butlerPath,
      userVersion: options.userVersion,
      ignore,
    });

    if (!result.success) {
      throw new Error(`itch.io deployment failed: ${result.failureReason}`);
    }

    console.log(`itch.io deployment succeeded: ${user}/${game}:${channel}`);
    return true;
  }
}
