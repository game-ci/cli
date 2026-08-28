import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import { SteamCmdRunner, resolveUseDocker } from "./steamcmd-runner";

/** A fake child_process that immediately succeeds with the given stdout, matching the shape SteamCmdRunner reads from. */
function fakeSpawn(stdout: string, exitCode = 0) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const spawnFn = vi.fn((command: string, args: string[]) => {
    calls.push({ command, args });
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    // Deferred so listeners are attached before events fire - matches real child_process timing.
    setImmediate(() => {
      child.stdout.emit("data", Buffer.from(stdout));
      child.emit("close", exitCode);
    });
    return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
  });
  return { spawnFn, calls };
}

describe("SteamCmdRunner", () => {
  let tempDir: string;
  let localSteamCmdPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steamcmd-runner-test-"));
    localSteamCmdPath = path.join(tempDir, "steamcmd.sh");
    fs.writeFileSync(localSteamCmdPath, "#!/bin/sh\n");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("logs in with username/password only when no totp is given", async () => {
    const { spawnFn, calls } = fakeSpawn("Success!");
    const runner = new SteamCmdRunner(spawnFn);

    await runner.run({
      buildDir: tempDir,
      username: "u",
      password: "p",
      mode: "local",
      steamCmdPath: localSteamCmdPath,
    });

    expect(calls[0].args).toEqual([
      "+login",
      "u",
      "p",
      "+run_app_build",
      `${tempDir.replace(/\\/g, "/")}/manifest.vdf`,
      "+quit",
    ]);
  });

  it("logs in with just the username when password is omitted (relying on a configVdf session)", async () => {
    const { spawnFn, calls } = fakeSpawn("Success!");
    const runner = new SteamCmdRunner(spawnFn);

    await runner.run({
      buildDir: tempDir,
      username: "u",
      mode: "local",
      steamCmdPath: localSteamCmdPath,
      configVdfBase64: Buffer.from("session").toString("base64"),
    });

    expect(calls[0].args).toEqual([
      "+login",
      "u",
      "+run_app_build",
      `${tempDir.replace(/\\/g, "/")}/manifest.vdf`,
      "+quit",
    ]);
  });

  it("reuses the same configVdf session across repeated runs without ever needing a TOTP code", async () => {
    // Regression test for a real gotcha in the old standalone action's
    // history (raised on game-ci/steam-deploy#92's review): once a 2FA
    // method is applied, it must persist across runs - a config.vdf is
    // exactly that persisted session, supplied fresh from a secret on
    // every run (not derived from on-disk state), so no run after the
    // first should ever need a TOTP prompt as long as configVdfBase64 is
    // set. Mirrors steam-deploy's own CI "Deploy to Steam" job, which runs
    // the action twice in a row with the same configVdf and no totp.
    const steamHome = path.join(tempDir, "steam-home-repeat");
    const configVdfBase64 = Buffer.from("persisted session").toString("base64");

    for (let run = 0; run < 2; run++) {
      const { spawnFn, calls } = fakeSpawn("Success!");
      const runner = new SteamCmdRunner(spawnFn);

      await runner.run({
        buildDir: tempDir,
        username: "u",
        mode: "local",
        steamCmdPath: localSteamCmdPath,
        steamHome,
        configVdfBase64,
      });

      expect(calls[0].args).not.toContain("+set_steam_guard_code");
      expect(calls[0].args[0]).toBe("+login");
      expect(calls[0].args[1]).toBe("u");
      expect(fs.readFileSync(path.join(steamHome, "config", "config.vdf"), "utf8")).toBe("persisted session");
    }
  });

  it("prepends +set_steam_guard_code when totp is given", async () => {
    const { spawnFn, calls } = fakeSpawn("Success!");
    const runner = new SteamCmdRunner(spawnFn);

    await runner.run({
      buildDir: tempDir,
      username: "u",
      password: "p",
      mode: "local",
      steamCmdPath: localSteamCmdPath,
      totp: "123456",
    });

    expect(calls[0].args.slice(0, 5)).toEqual(["+set_steam_guard_code", "123456", "+login", "u", "p"]);
  });

  it("writes configVdfBase64 to steamHome/config/config.vdf in local mode", async () => {
    const { spawnFn } = fakeSpawn("Success!");
    const runner = new SteamCmdRunner(spawnFn);
    const steamHome = path.join(tempDir, "steam-home");
    const decoded = "fake config.vdf contents";

    await runner.run({
      buildDir: tempDir,
      username: "u",
      password: "p",
      mode: "local",
      steamCmdPath: localSteamCmdPath,
      steamHome,
      configVdfBase64: Buffer.from(decoded).toString("base64"),
    });

    expect(fs.readFileSync(path.join(steamHome, "config", "config.vdf"), "utf8")).toBe(decoded);
  });

  it("does not write config.vdf when totp is given, even if configVdfBase64 is also set", async () => {
    const { spawnFn } = fakeSpawn("Success!");
    const runner = new SteamCmdRunner(spawnFn);
    const steamHome = path.join(tempDir, "steam-home");

    await runner.run({
      buildDir: tempDir,
      username: "u",
      password: "p",
      mode: "local",
      steamCmdPath: localSteamCmdPath,
      steamHome,
      totp: "123456",
      configVdfBase64: Buffer.from("should not be written").toString("base64"),
    });

    expect(fs.existsSync(path.join(steamHome, "config", "config.vdf"))).toBe(false);
  });

  it("runs via docker when mode=docker, mounting the build dir and a steamConfigDir when given", async () => {
    const { spawnFn, calls } = fakeSpawn("Success!");
    const runner = new SteamCmdRunner(spawnFn);

    await runner.run({
      buildDir: "/host/build",
      username: "u",
      password: "p",
      mode: "docker",
      steamConfigDir: "/host/steam-config",
    });

    expect(calls[0].command).toBe("docker");
    expect(calls[0].args).toContain("-v");
    expect(calls[0].args).toContain("/host/build:/build");
    expect(calls[0].args).toContain("/host/steam-config:/home/steam/Steam");
    expect(calls[0].args).toContain("cm2network/steamcmd:latest");
  });

  it("mounts a config.vdf written from configVdfBase64 in docker mode when no steamConfigDir is given", async () => {
    const { spawnFn, calls } = fakeSpawn("Success!");
    const runner = new SteamCmdRunner(spawnFn);
    const steamHome = path.join(tempDir, "steam-home-docker");

    await runner.run({
      buildDir: "/host/build",
      username: "u",
      password: "p",
      mode: "docker",
      steamHome,
      configVdfBase64: Buffer.from("docker config contents").toString("base64"),
    });

    expect(fs.readFileSync(path.join(steamHome, "config", "config.vdf"), "utf8")).toBe("docker config contents");
    expect(calls[0].args).toContain(`${steamHome}:/home/steam/Steam`);
  });

  it("throws a clear error when local mode is requested but steamcmd can't be found", async () => {
    const { spawnFn } = fakeSpawn("unused");
    const runner = new SteamCmdRunner(spawnFn);

    await expect(
      runner.run({
        buildDir: tempDir,
        username: "u",
        password: "p",
        mode: "local",
        steamCmdPath: path.join(tempDir, "does-not-exist.sh"),
      }),
    ).rejects.toThrow(/steamcmd was not found locally/);
  });
});

describe("resolveUseDocker", () => {
  it("is true for mode=docker regardless of a local steamcmd's presence", () => {
    expect(resolveUseDocker("docker", "/does/not/exist")).toBe(true);
  });

  it("is false for mode=local regardless of a local steamcmd's presence", () => {
    expect(resolveUseDocker("local", "/does/not/exist")).toBe(false);
  });

  it("falls back to docker for mode=auto when no local steamcmd is found", () => {
    // Regression test for a real bug (game-ci/steam-deploy#92's live CI):
    // steam-deploy-command.ts used to decide the manifest's contentroot
    // via a literal `mode === "docker"` check, which stayed false for
    // mode=auto even when run() itself fell back to Docker here - writing
    // a host absolute path into the manifest for a build that then
    // actually executed inside a container, where only /build was
    // mounted. This function is now the single source of truth both
    // callers share.
    expect(resolveUseDocker("auto", "/does/not/exist")).toBe(true);
  });
});
