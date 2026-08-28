import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { ButlerRunner } from "./butler-runner";

function fakeSpawn(exitCode: number, output = "") {
  const calls: Array<{ command: string; args: string[] }> = [];
  const spawnFn = vi.fn((command: string, args: string[]) => {
    calls.push({ command, args });
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

describe("ButlerRunner", () => {
  it("builds the expected push argv", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const runner = new ButlerRunner(spawnFn);

    await runner.push({ buildDir: "./build", target: "user/game", channel: "windows" });

    expect(calls[0].command).toBe("butler");
    expect(calls[0].args).toEqual(["push", "./build", "user/game:windows"]);
  });

  it("uses butlerPath when given instead of the bare PATH-resolved binary", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const runner = new ButlerRunner(spawnFn);

    await runner.push({ buildDir: "./build", target: "user/game", channel: "windows", butlerPath: "/opt/butler/butler" });

    expect(calls[0].command).toBe("/opt/butler/butler");
  });

  it("appends --userversion when given", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const runner = new ButlerRunner(spawnFn);

    await runner.push({ buildDir: "./build", target: "user/game", channel: "windows", userVersion: "1.2.3" });

    expect(calls[0].args).toContain("--userversion");
    expect(calls[0].args[calls[0].args.indexOf("--userversion") + 1]).toBe("1.2.3");
  });

  it("appends a repeated --ignore flag per pattern", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const runner = new ButlerRunner(spawnFn);

    await runner.push({ buildDir: "./build", target: "user/game", channel: "windows", ignore: ["*.pdb", "*.log"] });

    const ignoreIndices = calls[0].args.reduce<number[]>((acc, arg, i) => (arg === "--ignore" ? [...acc, i] : acc), []);
    expect(ignoreIndices).toHaveLength(2);
    expect(calls[0].args[ignoreIndices[0] + 1]).toBe("*.pdb");
    expect(calls[0].args[ignoreIndices[1] + 1]).toBe("*.log");
  });

  it("resolves success on exit code 0", async () => {
    const { spawnFn } = fakeSpawn(0);
    const runner = new ButlerRunner(spawnFn);

    const result = await runner.push({ buildDir: "./build", target: "user/game", channel: "windows" });

    expect(result).toEqual({ success: true });
  });

  it("surfaces the output tail on a non-zero exit code", async () => {
    const { spawnFn } = fakeSpawn(1, "Logging in...\nError: invalid API key\n");
    const runner = new ButlerRunner(spawnFn);

    const result = await runner.push({ buildDir: "./build", target: "user/game", channel: "windows" });

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("exit code 1");
    expect(result.failureReason).toContain("invalid API key");
  });

  it("falls back to a bare exit code when there is no output", async () => {
    const { spawnFn } = fakeSpawn(1);
    const runner = new ButlerRunner(spawnFn);

    const result = await runner.push({ buildDir: "./build", target: "user/game", channel: "windows" });

    expect(result.failureReason).toBe("exit code 1");
  });
});
