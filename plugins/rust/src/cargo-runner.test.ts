import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { CargoRunner, cargoBuildArgs, cargoTestArgs, cargoOutputDir, binaryFileName } from "./cargo-runner";

function fakeSpawn(exitCode: number, output = "") {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const spawnFn = vi.fn((command: string, args: string[], opts?: { cwd?: string }) => {
    calls.push({ command, args, cwd: opts?.cwd });
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      if (output) child.stdout.emit("data", Buffer.from(output));
      child.emit("close", exitCode);
    });
    return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
  });
  return { spawnFn, calls };
}

describe("cargoBuildArgs", () => {
  it("defaults to a release build", () => {
    expect(cargoBuildArgs()).toEqual(["build", "--release"]);
  });

  it("omits --release in debug mode", () => {
    expect(cargoBuildArgs({ debug: true })).toEqual(["build"]);
  });

  it("includes --target when given", () => {
    expect(cargoBuildArgs({ target: "x86_64-pc-windows-gnu" })).toEqual(["build", "--release", "--target", "x86_64-pc-windows-gnu"]);
  });

  it("includes --features when given", () => {
    expect(cargoBuildArgs({ features: "audio,networking" })).toContain("--features");
  });

  it("includes --locked only when requested", () => {
    expect(cargoBuildArgs({ locked: true })).toContain("--locked");
    expect(cargoBuildArgs({ locked: false })).not.toContain("--locked");
  });
});

describe("cargoTestArgs", () => {
  it("always runs a release test build", () => {
    expect(cargoTestArgs()).toEqual(["test", "--release"]);
  });

  it("includes --target and --features when given", () => {
    const args = cargoTestArgs({ target: "x86_64-unknown-linux-gnu", features: "audio" });
    expect(args).toContain("--target");
    expect(args).toContain("--features");
  });
});

describe("cargoOutputDir", () => {
  it("resolves the host release dir with no target", () => {
    expect(cargoOutputDir(undefined, false)).toBe("target/release");
  });

  it("resolves the host debug dir", () => {
    expect(cargoOutputDir(undefined, true)).toBe("target/debug");
  });

  it("resolves a cross-compiled target's release dir", () => {
    expect(cargoOutputDir("x86_64-pc-windows-gnu", false)).toBe("target/x86_64-pc-windows-gnu/release");
  });
});

describe("binaryFileName", () => {
  it("appends .exe for a windows target regardless of host platform", () => {
    expect(binaryFileName("my-game", "x86_64-pc-windows-gnu")).toBe("my-game.exe");
  });

  it("has no extension for a non-windows target", () => {
    expect(binaryFileName("my-game", "x86_64-unknown-linux-gnu")).toBe("my-game");
  });
});

describe("CargoRunner", () => {
  it("runs cargo build in the project directory", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const runner = new CargoRunner(spawnFn);

    const result = await runner.build("/my/project", { target: "x86_64-unknown-linux-gnu" });

    expect(result.success).toBe(true);
    expect(calls[0].command).toBe("cargo");
    expect(calls[0].cwd).toBe("/my/project");
    expect(calls[0].args).toContain("build");
  });

  it("reports failure output on a non-zero exit", async () => {
    const { spawnFn } = fakeSpawn(1, "error[E0433]: failed to resolve");
    const runner = new CargoRunner(spawnFn);

    const result = await runner.build("/my/project");

    expect(result.success).toBe(false);
    expect(result.output).toContain("E0433");
  });

  it("runs cargo test", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const runner = new CargoRunner(spawnFn);

    await runner.test("/my/project");

    expect(calls[0].args).toContain("test");
  });
});
