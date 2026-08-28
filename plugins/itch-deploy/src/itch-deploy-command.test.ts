import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ItchDeployCommand } from "./itch-deploy-command";
import * as butlerRunnerModule from "./butler-runner";

describe("ItchDeployCommand", () => {
  let tempDir: string;
  const originalKey = process.env.BUTLER_API_KEY;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "itch-deploy-test-"));
    process.env.BUTLER_API_KEY = "test-key";
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env.BUTLER_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("throws when the build path is missing", async () => {
    const command = new ItchDeployCommand();
    await expect(command.execute({ user: "u", game: "g", channel: "windows" })).rejects.toThrow(/build path is required/);
  });

  it("throws when the build path does not exist", async () => {
    const command = new ItchDeployCommand();
    await expect(
      command.execute({ buildPath: path.join(tempDir, "nope"), user: "u", game: "g", channel: "windows" }),
    ).rejects.toThrow(/does not exist/);
  });

  it("throws when BUTLER_API_KEY is not set", async () => {
    delete process.env.BUTLER_API_KEY;
    const command = new ItchDeployCommand();
    await expect(command.execute({ buildPath: tempDir, user: "u", game: "g", channel: "windows" })).rejects.toThrow(
      /BUTLER_API_KEY/,
    );
  });

  it("pushes with the expected target/channel and surfaces success", async () => {
    const pushSpy = vi.spyOn(butlerRunnerModule.ButlerRunner.prototype, "push").mockResolvedValue({ success: true });

    const command = new ItchDeployCommand();
    const result = await command.execute({ buildPath: tempDir, user: "myuser", game: "mygame", channel: "windows" });

    expect(result).toBe(true);
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ buildDir: tempDir, target: "myuser/mygame", channel: "windows" }),
    );
  });

  it("splits --ignore on commas into an array", async () => {
    const pushSpy = vi.spyOn(butlerRunnerModule.ButlerRunner.prototype, "push").mockResolvedValue({ success: true });

    const command = new ItchDeployCommand();
    await command.execute({ buildPath: tempDir, user: "u", game: "g", channel: "windows", ignore: "*.pdb, *.log" });

    expect(pushSpy).toHaveBeenCalledWith(expect.objectContaining({ ignore: ["*.pdb", "*.log"] }));
  });

  it("throws with the runner's failure reason when the push fails", async () => {
    vi.spyOn(butlerRunnerModule.ButlerRunner.prototype, "push").mockResolvedValue({
      success: false,
      failureReason: "exit code 1: invalid API key",
    });

    const command = new ItchDeployCommand();
    await expect(command.execute({ buildPath: tempDir, user: "u", game: "g", channel: "windows" })).rejects.toThrow(
      /invalid API key/,
    );
  });
});
