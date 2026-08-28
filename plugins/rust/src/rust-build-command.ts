import * as fs from "node:fs";
import * as path from "node:path";
import { CargoRunner, cargoOutputDir, binaryFileName } from "./cargo-runner";
import { readCargoToml, readCargoPackageName } from "./rust-project-detector";

export interface RustBuildOptions {
  projectPath?: string;
  target?: string;
  features?: string;
  locked?: boolean;
  debug?: boolean;
  /** Directory to copy the built binary into, e.g. for a downstream deploy step. */
  outputPath?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

export class RustBuildCommand {
  public readonly name = "Build Rust project";

  constructor(private readonly cargoRunner: CargoRunner = new CargoRunner()) {}

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("target", {
        describe: 'Rust target triple, e.g. "x86_64-pc-windows-gnu". Builds for the host toolchain when omitted.',
        type: "string",
      })
      .option("features", {
        describe: "Comma-separated cargo features to enable.",
        type: "string",
      })
      .option("locked", {
        describe: "Fail instead of updating Cargo.lock. Recommended for CI reproducibility.",
        type: "boolean",
        default: true,
      })
      .option("debug", {
        describe: "Build in debug mode instead of --release.",
        type: "boolean",
        default: false,
      })
      .option("outputPath", {
        describe: "Directory to copy the built binary into.",
        type: "string",
      });
  }

  public async execute(options: RustBuildOptions): Promise<boolean> {
    const projectPath = options.projectPath || ".";
    const absoluteProjectPath = path.resolve(projectPath);
    if (!fs.existsSync(path.join(absoluteProjectPath, "Cargo.toml"))) {
      throw new Error(`No Cargo.toml found at "${absoluteProjectPath}".`);
    }

    const packageName = readCargoPackageName(readCargoToml(absoluteProjectPath));
    if (!packageName) {
      throw new Error(`Could not determine the package/binary name from "${path.join(absoluteProjectPath, "Cargo.toml")}".`);
    }

    console.log(`Building ${packageName} (cargo build${options.debug ? "" : " --release"}${options.target ? ` --target ${options.target}` : ""})`);

    const result = await this.cargoRunner.build(absoluteProjectPath, {
      target: options.target,
      features: options.features,
      locked: options.locked ?? true,
      debug: options.debug,
    });

    if (!result.success) {
      throw new Error(`cargo build failed: ${result.output}`);
    }

    const outputDir = path.join(absoluteProjectPath, cargoOutputDir(options.target, options.debug));
    const binaryName = binaryFileName(packageName, options.target);
    const binaryPath = path.join(outputDir, binaryName);

    if (!fs.existsSync(binaryPath)) {
      throw new Error(
        `cargo build reported success but the expected binary was not found at "${binaryPath}". ` +
          "If your Cargo.toml defines a different [[bin]] name than the package name, this needs investigating.",
      );
    }

    console.log(`Built ${binaryPath}`);

    if (options.outputPath) {
      const destDir = path.resolve(options.outputPath);
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, binaryName);
      fs.copyFileSync(binaryPath, destPath);
      console.log(`Copied to ${destPath}`);
    }

    return true;
  }
}
