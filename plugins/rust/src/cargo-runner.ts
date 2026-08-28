import { spawn } from "node:child_process";

type SpawnFn = typeof spawn;

export interface CargoBuildOptions {
  /** Rust target triple, e.g. "x86_64-pc-windows-gnu". Omit to build for the host. */
  target?: string;
  /** Comma-separated cargo features to enable, matching cargo's own --features value format. */
  features?: string;
  /** --locked: fail instead of updating Cargo.lock - recommended for CI reproducibility. */
  locked?: boolean;
  /** Build in debug mode instead of --release. Default false (release). */
  debug?: boolean;
}

export function cargoBuildArgs(options: CargoBuildOptions = {}): string[] {
  const args = ["build"];
  if (!options.debug) args.push("--release");
  if (options.target) args.push("--target", options.target);
  if (options.features) args.push("--features", options.features);
  if (options.locked) args.push("--locked");
  return args;
}

export interface CargoTestOptions {
  target?: string;
  features?: string;
  locked?: boolean;
}

export function cargoTestArgs(options: CargoTestOptions = {}): string[] {
  const args = ["test", "--release"];
  if (options.target) args.push("--target", options.target);
  if (options.features) args.push("--features", options.features);
  if (options.locked) args.push("--locked");
  return args;
}

/**
 * The directory cargo places build artifacts under, relative to the
 * project root - real, stable cargo behavior: target/release/<bin> for a
 * host build, target/<target-triple>/release/<bin> when --target is
 * given. Not configurable here (cargo itself supports overriding via
 * CARGO_TARGET_DIR/--target-dir, but this plugin doesn't need to
 * second-guess a project's own build.rs/config.toml settings for it).
 */
export function cargoOutputDir(target: string | undefined, debug: boolean | undefined): string {
  const profile = debug ? "debug" : "release";
  return target ? `target/${target}/${profile}` : `target/${profile}`;
}

/** cargo/rustc's own platform-specific executable naming - matches how every other build tool in this repo resolves its own output binary name. */
export function binaryFileName(packageName: string, target: string | undefined): string {
  const isWindows = target ? target.includes("windows") : process.platform === "win32";
  return isWindows ? `${packageName}.exe` : packageName;
}

export interface CargoRunResult {
  success: boolean;
  output: string;
  exitCode: number;
}

function runProcess(spawnFn: SpawnFn, cwd: string, args: string[]): Promise<CargoRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawnFn("cargo", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk.toString()));
    child.stderr?.on("data", (chunk) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ success: exitCode === 0, output, exitCode: exitCode ?? 1 }));
  });
}

export class CargoRunner {
  constructor(private readonly spawnFn: SpawnFn = spawn) {}

  build(projectPath: string, options: CargoBuildOptions = {}): Promise<CargoRunResult> {
    return runProcess(this.spawnFn, projectPath, cargoBuildArgs(options));
  }

  test(projectPath: string, options: CargoTestOptions = {}): Promise<CargoRunResult> {
    return runProcess(this.spawnFn, projectPath, cargoTestArgs(options));
  }
}
