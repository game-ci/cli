import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  isRustProject,
  readCargoPackageName,
  readCargoPackageVersion,
  readRustToolchainVersion,
} from "./rust-project-detector";

describe("isRustProject", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rust-detector-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns false when there is no Cargo.toml", () => {
    expect(isRustProject(tempDir)).toBe(false);
  });

  it("returns true when Cargo.toml exists", () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n');
    expect(isRustProject(tempDir)).toBe(true);
  });
});

describe("readCargoPackageName", () => {
  it("reads the package name", () => {
    const toml = '[package]\nname = "my-game"\nversion = "0.1.0"\n';
    expect(readCargoPackageName(toml)).toBe("my-game");
  });

  it("prefers an explicit [[bin]] name over the package name", () => {
    const toml = '[package]\nname = "my-game"\nversion = "0.1.0"\n\n[[bin]]\nname = "my-game-launcher"\npath = "src/main.rs"\n';
    expect(readCargoPackageName(toml)).toBe("my-game-launcher");
  });

  it("returns null when no name can be found", () => {
    expect(readCargoPackageName("[workspace]\nmembers = []\n")).toBeNull();
  });
});

describe("readCargoPackageVersion", () => {
  it("reads the package version", () => {
    const toml = '[package]\nname = "my-game"\nversion = "1.2.3"\n';
    expect(readCargoPackageVersion(toml)).toBe("1.2.3");
  });

  it("returns null when no version is present", () => {
    expect(readCargoPackageVersion('[package]\nname = "my-game"\n')).toBeNull();
  });
});

describe("readRustToolchainVersion", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rust-toolchain-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("defaults to stable when no toolchain file exists", () => {
    expect(readRustToolchainVersion(tempDir)).toBe("stable");
  });

  it("reads the channel from rust-toolchain.toml", () => {
    fs.writeFileSync(path.join(tempDir, "rust-toolchain.toml"), '[toolchain]\nchannel = "1.75.0"\n');
    expect(readRustToolchainVersion(tempDir)).toBe("1.75.0");
  });

  it("falls back to the legacy rust-toolchain file", () => {
    fs.writeFileSync(path.join(tempDir, "rust-toolchain"), "1.70.0\n");
    expect(readRustToolchainVersion(tempDir)).toBe("1.70.0");
  });

  it("prefers rust-toolchain.toml over the legacy file when both exist", () => {
    fs.writeFileSync(path.join(tempDir, "rust-toolchain.toml"), '[toolchain]\nchannel = "nightly"\n');
    fs.writeFileSync(path.join(tempDir, "rust-toolchain"), "1.70.0\n");
    expect(readRustToolchainVersion(tempDir)).toBe("nightly");
  });
});
