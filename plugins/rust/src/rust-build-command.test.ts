import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { RustBuildCommand } from "./rust-build-command";
import { CargoRunner, binaryFileName } from "./cargo-runner";

describe("RustBuildCommand", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rust-build-command-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeBuiltBinary(target?: string, debug?: boolean) {
    const outDir = target ? path.join(tempDir, "target", target, debug ? "debug" : "release") : path.join(tempDir, "target", debug ? "debug" : "release");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, binaryFileName("my-game", target)), "binary");
  }

  function cargoRunnerStub(overrides: Partial<Record<"build" | "test", any>> = {}) {
    return {
      build: vi.fn().mockResolvedValue({ success: true, output: "", exitCode: 0 }),
      test: vi.fn().mockResolvedValue({ success: true, output: "", exitCode: 0 }),
      ...overrides,
    } as unknown as CargoRunner;
  }

  it("throws when there is no Cargo.toml", async () => {
    const command = new RustBuildCommand(cargoRunnerStub());
    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/No Cargo.toml found/);
  });

  it("throws when the package name can't be determined", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), "[workspace]\nmembers = []\n");
    const command = new RustBuildCommand(cargoRunnerStub());
    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/Could not determine the package/);
  });

  it("throws with cargo's output when the build fails", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    const runner = cargoRunnerStub({ build: vi.fn().mockResolvedValue({ success: false, output: "compile error", exitCode: 1 }) });
    const command = new RustBuildCommand(runner);

    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/compile error/);
  });

  it("throws when cargo reports success but the binary isn't where expected", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    const command = new RustBuildCommand(cargoRunnerStub());

    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/was not found/);
  });

  it("succeeds and locates the built binary", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    writeBuiltBinary();
    const command = new RustBuildCommand(cargoRunnerStub());

    const result = await command.execute({ projectPath: tempDir });

    expect(result).toBe(true);
  });

  it("copies the binary to outputPath when given", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    writeBuiltBinary();
    const outputDir = path.join(tempDir, "dist");
    const command = new RustBuildCommand(cargoRunnerStub());

    await command.execute({ projectPath: tempDir, outputPath: outputDir });

    expect(fs.existsSync(path.join(outputDir, binaryFileName("my-game", undefined)))).toBe(true);
  });

  it("passes locked=true to cargo by default", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    writeBuiltBinary();
    const runner = cargoRunnerStub();
    const command = new RustBuildCommand(runner);

    await command.execute({ projectPath: tempDir });

    expect(runner.build).toHaveBeenCalledWith(path.resolve(tempDir), expect.objectContaining({ locked: true }));
  });
});
