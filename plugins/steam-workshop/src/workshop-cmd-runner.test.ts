import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import { WorkshopCmdRunner } from "./workshop-cmd-runner";

function fakeSpawn(stdout: string, exitCode = 0) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const spawnFn = vi.fn((command: string, args: string[]) => {
    calls.push({ command, args });
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      child.stdout.emit("data", Buffer.from(stdout));
      child.emit("close", exitCode);
    });
    return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
  });
  return { spawnFn, calls };
}

describe("WorkshopCmdRunner", () => {
  let tempDir: string;
  let localSteamCmdPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workshop-cmd-runner-test-"));
    localSteamCmdPath = path.join(tempDir, "steamcmd.sh");
    fs.writeFileSync(localSteamCmdPath, "#!/bin/sh\n");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("builds the +workshop_build_item login argv in local mode", async () => {
    const { spawnFn, calls } = fakeSpawn("PublishedFileId: 1", 0);
    const runner = new WorkshopCmdRunner(spawnFn);

    await runner.upload({
      workDir: tempDir,
      vdfFileName: "workshop_build_item.vdf",
      username: "u",
      password: "p",
      mode: "local",
      steamCmdPath: localSteamCmdPath,
    });

    expect(calls[0].command).toBe(localSteamCmdPath);
    expect(calls[0].args).toEqual([
      "+login",
      "u",
      "p",
      "+workshop_build_item",
      `${tempDir.replace(/\\/g, "/")}/workshop_build_item.vdf`,
      "+quit",
    ]);
  });

  it("mounts workDir and points the vdf path at the container mount in docker mode", async () => {
    const { spawnFn, calls } = fakeSpawn("PublishedFileId: 1", 0);
    const runner = new WorkshopCmdRunner(spawnFn);

    await runner.upload({
      workDir: "/host/item",
      vdfFileName: "workshop_build_item.vdf",
      username: "u",
      password: "p",
      mode: "docker",
    });

    expect(calls[0].command).toBe("docker");
    expect(calls[0].args).toContain("/host/item:/build");
    expect(calls[0].args).toContain("/build/workshop_build_item.vdf");
  });

  it("throws a clear error when local mode is requested but steamcmd can't be found", async () => {
    const { spawnFn } = fakeSpawn("unused");
    const runner = new WorkshopCmdRunner(spawnFn);

    await expect(
      runner.upload({
        workDir: tempDir,
        vdfFileName: "workshop_build_item.vdf",
        username: "u",
        password: "p",
        mode: "local",
        steamCmdPath: path.join(tempDir, "does-not-exist.sh"),
      }),
    ).rejects.toThrow(/steamcmd was not found locally/);
  });

  it("returns the parsed result from a successful upload", async () => {
    const { spawnFn } = fakeSpawn("PublishedFileId: 999", 0);
    const runner = new WorkshopCmdRunner(spawnFn);

    const result = await runner.upload({
      workDir: tempDir,
      vdfFileName: "workshop_build_item.vdf",
      username: "u",
      password: "p",
      mode: "local",
      steamCmdPath: localSteamCmdPath,
    });

    expect(result).toEqual({ success: true, publishedFileId: "999" });
  });
});
