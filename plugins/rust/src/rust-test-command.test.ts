import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { RustTestCommand } from "./rust-test-command";
import { CargoRunner } from "./cargo-runner";

describe("RustTestCommand", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rust-test-command-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function cargoRunnerStub(result: { success: boolean; output: string; exitCode: number }) {
    return { build: vi.fn(), test: vi.fn().mockResolvedValue(result) } as unknown as CargoRunner;
  }

  it("throws when there is no Cargo.toml", async () => {
    const command = new RustTestCommand(cargoRunnerStub({ success: true, output: "", exitCode: 0 }));
    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/No Cargo.toml found/);
  });

  it("returns true when cargo test passes", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    const command = new RustTestCommand(cargoRunnerStub({ success: true, output: "", exitCode: 0 }));

    const result = await command.execute({ projectPath: tempDir });

    expect(result).toBe(true);
  });

  it("throws with cargo's output when tests fail", async () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    const command = new RustTestCommand(cargoRunnerStub({ success: false, output: "1 test failed", exitCode: 1 }));

    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/1 test failed/);
  });
});
