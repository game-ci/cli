import * as fs from "node:fs";
import * as path from "node:path";
import { CargoRunner } from "./cargo-runner";
import { isBevyProject } from "./bevy-project-detector";

export interface BevyTestOptions {
  projectPath?: string;
  target?: string;
  features?: string;
  locked?: boolean;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

export class BevyTestCommand {
  public readonly name = "Test Bevy project";

  constructor(private readonly cargoRunner: CargoRunner = new CargoRunner()) {}

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("target", {
        describe: 'Rust target triple, e.g. "x86_64-pc-windows-gnu".',
        type: "string",
      })
      .option("features", {
        describe: "Comma-separated cargo features to enable.",
        type: "string",
      })
      .option("locked", {
        describe: "Fail instead of updating Cargo.lock.",
        type: "boolean",
        default: true,
      });
  }

  public async execute(options: BevyTestOptions): Promise<boolean> {
    const projectPath = options.projectPath || ".";
    const absoluteProjectPath = path.resolve(projectPath);
    if (!fs.existsSync(path.join(absoluteProjectPath, "Cargo.toml"))) {
      throw new Error(`No Cargo.toml found at "${absoluteProjectPath}".`);
    }
    if (!isBevyProject(absoluteProjectPath)) {
      throw new Error(`No bevy dependency found in "${path.join(absoluteProjectPath, "Cargo.toml")}" - this command is Bevy-specific.`);
    }

    console.log(`Testing project at ${absoluteProjectPath} (cargo test --release)`);

    const result = await this.cargoRunner.test(absoluteProjectPath, {
      target: options.target,
      features: options.features,
      locked: options.locked ?? true,
    });

    if (!result.success) {
      throw new Error(`cargo test failed: ${result.output}`);
    }

    console.log("cargo test passed.");
    return true;
  }
}
