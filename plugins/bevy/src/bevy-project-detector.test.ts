import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  isBevyProject,
  hasBevyDependency,
  readCargoPackageName,
  readCargoPackageVersion,
  readRustToolchainVersion,
} from "./bevy-project-detector";

describe("hasBevyDependency", () => {
  it("matches a simple version-string dependency", () => {
    expect(hasBevyDependency('[dependencies]\nbevy = "0.14"\n')).toBe(true);
  });

  it("matches an inline-table dependency", () => {
    expect(hasBevyDependency('[dependencies]\nbevy = { version = "0.14", default-features = false }\n')).toBe(true);
  });

  it("matches a [dependencies.bevy] table", () => {
    expect(hasBevyDependency('[dependencies.bevy]\nversion = "0.14"\n')).toBe(true);
  });

  it("returns false for a Cargo.toml with no bevy dependency", () => {
    expect(hasBevyDependency('[package]\nname = "not-a-game"\n\n[dependencies]\nserde = "1"\n')).toBe(false);
  });

  it("does not match a substring like bevy_ecs alone (only the bevy crate itself)", () => {
    expect(hasBevyDependency('[dependencies]\nbevy_ecs = "0.14"\n')).toBe(false);
  });
});

describe("isBevyProject", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bevy-detector-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns false when there is no Cargo.toml", () => {
    expect(isBevyProject(tempDir)).toBe(false);
  });

  it("returns false for a plain Rust crate with no bevy dependency", () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-cli-tool"\n');
    expect(isBevyProject(tempDir)).toBe(false);
  });

  it("returns true for a Cargo.toml that depends on bevy", () => {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), '[package]\nname = "my-game"\n\n[dependencies]\nbevy = "0.14"\n');
    expect(isBevyProject(tempDir)).toBe(true);
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
