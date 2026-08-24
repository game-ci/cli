import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { launchAndCollectResults } from "./launch-and-collect-results";

function fakeChildProcess() {
  const emitter = new EventEmitter() as EventEmitter & { kill: () => void };
  emitter.kill = vi.fn();
  return emitter;
}

describe("launchAndCollectResults", () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const file of tempFiles) {
      fs.rmSync(file, { force: true });
    }
    tempFiles.length = 0;
  });

  function makeResultsPath(): string {
    const filePath = path.join(os.tmpdir(), `game-ci-runtime-test-${Date.now()}-${Math.random()}.json`);
    tempFiles.push(filePath);
    return filePath;
  }

  it("reads and parses the results file after the player exits", async () => {
    const resultsPath = makeResultsPath();
    const child = fakeChildProcess();
    const spawnFn = vi.fn(() => {
      // Simulate the player writing its results file, then exiting.
      fs.writeFileSync(resultsPath, JSON.stringify({ schemaVersion: 1, tests: [{ name: "a", passed: true }] }));
      setImmediate(() => child.emit("exit", 0));
      return child;
    });

    const result = await launchAndCollectResults(
      { executablePath: "/fake/player", resultsPath, timeoutMs: 5000 },
      spawnFn as any,
    );

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.results.tests).toEqual([{ name: "a", passed: true }]);
    expect(spawnFn).toHaveBeenCalledWith(
      "/fake/player",
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          GAME_CI_RUNTIME_TEST_MODE: "1",
          GAME_CI_RUNTIME_TEST_RESULTS_PATH: resultsPath,
        }),
      }),
    );
  });

  it("throws when the player exits without writing a results file", async () => {
    const resultsPath = makeResultsPath();
    const child = fakeChildProcess();
    const spawnFn = vi.fn(() => {
      setImmediate(() => child.emit("exit", 0));
      return child;
    });

    await expect(
      launchAndCollectResults({ executablePath: "/fake/player", resultsPath, timeoutMs: 5000 }, spawnFn as any),
    ).rejects.toThrow(/without writing a results file/);
  });

  it("kills the process and throws on timeout", async () => {
    const resultsPath = makeResultsPath();
    const child = fakeChildProcess();
    const spawnFn = vi.fn(() => child); // never emits 'exit'

    await expect(
      launchAndCollectResults({ executablePath: "/fake/player", resultsPath, timeoutMs: 10 }, spawnFn as any),
    ).rejects.toThrow(/did not exit within/);
    expect(child.kill).toHaveBeenCalled();
  });

  it("deletes a stale results file left over from a previous run before launching", async () => {
    const resultsPath = makeResultsPath();
    fs.writeFileSync(resultsPath, JSON.stringify({ schemaVersion: 1, tests: [{ name: "stale", passed: false }] }));

    const child = fakeChildProcess();
    const spawnFn = vi.fn(() => {
      // This run's player never writes a fresh file - the stale one must not leak through.
      setImmediate(() => child.emit("exit", 0));
      return child;
    });

    await expect(
      launchAndCollectResults({ executablePath: "/fake/player", resultsPath, timeoutMs: 5000 }, spawnFn as any),
    ).rejects.toThrow(/without writing a results file/);
  });
});
