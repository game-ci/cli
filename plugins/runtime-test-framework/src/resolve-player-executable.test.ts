import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolvePlayerExecutable } from "./resolve-player-executable";

describe("resolvePlayerExecutable", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  function makeTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "game-ci-runtime-test-"));
    tempDirs.push(dir);
    return dir;
  }

  it("resolves a direct .exe path on Windows", () => {
    const dir = makeTempDir();
    const exePath = path.join(dir, "MyGame.exe");
    fs.writeFileSync(exePath, "");

    expect(resolvePlayerExecutable(exePath, "win32")).toBe(exePath);
  });

  it("finds the single .exe in a build directory on Windows", () => {
    const dir = makeTempDir();
    const exePath = path.join(dir, "MyGame.exe");
    fs.writeFileSync(exePath, "");
    fs.mkdirSync(path.join(dir, "MyGame_Data"));

    expect(resolvePlayerExecutable(dir, "win32")).toBe(exePath);
  });

  it("throws when multiple .exe candidates exist on Windows", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "MyGame.exe"), "");
    fs.writeFileSync(path.join(dir, "UnityCrashHandler64.exe"), "");

    expect(() => resolvePlayerExecutable(dir, "win32")).toThrow(/Multiple candidate executables/);
  });

  it("resolves the binary inside a .app bundle on macOS, matching the bundle name", () => {
    const dir = makeTempDir();
    const bundle = path.join(dir, "MyGame.app");
    const macOsDir = path.join(bundle, "Contents", "MacOS");
    fs.mkdirSync(macOsDir, { recursive: true });
    fs.writeFileSync(path.join(macOsDir, "MyGame"), "");

    expect(resolvePlayerExecutable(bundle, "darwin")).toBe(path.join(macOsDir, "MyGame"));
  });

  it("finds the single .app bundle in a directory on macOS", () => {
    const dir = makeTempDir();
    const bundle = path.join(dir, "MyGame.app");
    const macOsDir = path.join(bundle, "Contents", "MacOS");
    fs.mkdirSync(macOsDir, { recursive: true });
    fs.writeFileSync(path.join(macOsDir, "MyGame"), "");

    expect(resolvePlayerExecutable(dir, "darwin")).toBe(path.join(macOsDir, "MyGame"));
  });

  it("throws with a clear message when the expected macOS binary is missing", () => {
    const dir = makeTempDir();
    const bundle = path.join(dir, "MyGame.app");
    fs.mkdirSync(path.join(bundle, "Contents", "MacOS"), { recursive: true });
    // Deliberately no binary written inside Contents/MacOS.

    expect(() => resolvePlayerExecutable(bundle, "darwin")).toThrow(/does not exist/);
  });

  it("resolves a direct executable path on Linux", () => {
    const dir = makeTempDir();
    const exePath = path.join(dir, "MyGame.x86_64");
    fs.writeFileSync(exePath, "", { mode: 0o755 });

    expect(resolvePlayerExecutable(exePath, "linux")).toBe(exePath);
  });

  // Windows/NTFS doesn't represent POSIX permission bits, so writeFileSync's
  // `mode` option isn't actually observable via statSync here - this
  // exercises real behavior only on POSIX filesystems. The logic itself
  // (mode & 0o111) is platform-independent; only this specific assertion
  // needs a real POSIX filesystem to verify, which CI's Linux runners cover.
  it.skipIf(process.platform === "win32")("finds the single executable-bit file in a directory on Linux", () => {
    const dir = makeTempDir();
    const exePath = path.join(dir, "MyGame.x86_64");
    fs.writeFileSync(exePath, "", { mode: 0o755 });
    fs.writeFileSync(path.join(dir, "MyGame_Data.txt"), "", { mode: 0o644 });

    expect(resolvePlayerExecutable(dir, "linux")).toBe(exePath);
  });
});
