import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Detects a Rust project and reads just enough of its manifest to build
 * it - the package/binary name (cargo build's output file is named after
 * it) and the pinned toolchain version, if any. A minimal hand-rolled TOML
 * reader for the two fields actually needed, not a general TOML parser -
 * Cargo.toml's [package] table is simple, predictable key = "value" lines,
 * and pulling in a TOML dependency for two fields isn't worth it.
 */

export function isRustProject(projectPath: string): boolean {
  return fs.existsSync(path.join(projectPath, "Cargo.toml"));
}

/**
 * The name cargo builds the binary as (before any platform-specific
 * extension). Falls back to the package name when no [[bin]] table
 * overrides it - matches cargo's own default (a package named "my-game"
 * with no explicit [[bin]] produces target/release/my-game).
 */
export function readCargoPackageName(cargoTomlContent: string): string | null {
  const binNameMatch = /\[\[bin\]\][^[]*?\bname\s*=\s*"([^"]+)"/.exec(cargoTomlContent);
  if (binNameMatch) return binNameMatch[1];

  const packageMatch = /\[package\][^[]*?\bname\s*=\s*"([^"]+)"/.exec(cargoTomlContent);
  return packageMatch ? packageMatch[1] : null;
}

export function readCargoPackageVersion(cargoTomlContent: string): string | null {
  const packageMatch = /\[package\][^[]*?\bversion\s*=\s*"([^"]+)"/.exec(cargoTomlContent);
  return packageMatch ? packageMatch[1] : null;
}

/**
 * A rust-toolchain(.toml) file pins the exact toolchain a project builds
 * with (e.g. "1.75.0" or "stable") - the closest Rust equivalent to
 * Unity's ProjectVersion.txt/Godot's project.godot version field.
 * Returns "stable" when neither file is present, matching cargo's own
 * default resolution.
 */
export function readRustToolchainVersion(projectPath: string): string {
  const tomlPath = path.join(projectPath, "rust-toolchain.toml");
  if (fs.existsSync(tomlPath)) {
    const content = fs.readFileSync(tomlPath, "utf8");
    const match = /channel\s*=\s*"([^"]+)"/.exec(content);
    if (match) return match[1];
  }

  const legacyPath = path.join(projectPath, "rust-toolchain");
  if (fs.existsSync(legacyPath)) {
    const content = fs.readFileSync(legacyPath, "utf8").trim();
    if (content) return content;
  }

  return "stable";
}

export function readCargoToml(projectPath: string): string {
  return fs.readFileSync(path.join(projectPath, "Cargo.toml"), "utf8");
}
