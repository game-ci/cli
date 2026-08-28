import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BevyTestCommand } from "./bevy-test-command";
import { CargoRunner } from "./cargo-runner";

const BEVY_CARGO_TOML = '[package]\nname = "my-game"\n\n[dependencies]\nbevy = "0.14"\n';

describe("BevyTestCommand", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bevy-test-command-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function cargoRunnerStub(result: { success: boolean; output: string; exitCode: number }) {
    return { build: vi.fn(), test: vi.fn().mockResolvedValue(result) } as unknown as CargoRunner;
  }

  it("throws when there is no Cargo.toml", async () => {
    const command = new BevyTestCommand(cargoRunnerStub({ success: true, output: "", exitCode: 0 }));
    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/No Cargo.toml found/);
  });

  it("throws when Cargo.toml has no bevy dependency", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "not-a-game"\n');
    const command = new BevyTestCommand(cargoRunnerStub({ success: true, output: "", exitCode: 0 }));
    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/No bevy dependency found/);
  });

  it("returns true when cargo test passes", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), BEVY_CARGO_TOML);
    const command = new BevyTestCommand(cargoRunnerStub({ success: true, output: "", exitCode: 0 }));

    const result = await command.execute({ projectPath: tempDir });

    expect(result).toBe(true);
  });

  it("throws with cargo's output when tests fail", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), BEVY_CARGO_TOML);
    const command = new BevyTestCommand(cargoRunnerStub({ success: false, output: "1 test failed", exitCode: 1 }));

    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/1 test failed/);
  });
});
