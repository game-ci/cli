> **EXPERIMENTAL.** Functional, and registered by default in every `game-ci`
> binary (no `--plugin` flag needed) - not published to npm, so it's loaded
> the same way orchestrator/steam-deploy/runtime-test-framework are: a
> literal `import()` compiled directly into the binary.

# @game-ci/bevy

Detects a [Bevy](https://bevyengine.org/) project - a `bevy` dependency
in `Cargo.toml`, not just any Cargo project - and builds/tests it via
`cargo build --release`/`cargo test --release`. Bevy has no separate
build tool of its own; it's a regular Cargo dependency, so this plugin's
job is mostly correct detection (so it doesn't misclassify an unrelated
Rust crate as a game) plus locating cargo's own build output.

## Usage

Registered by default - just point `game-ci` at a Bevy project:

```bash
game-ci build ./my-game --target x86_64-pc-windows-gnu
game-ci test ./my-game
```

- Detected via a `bevy` dependency in `Cargo.toml` (a plain version
  string, an inline table, or a `[dependencies.bevy]` table - all three
  ways Cargo.toml can declare a dependency). Doesn't resolve
  workspace-inherited dependencies (`bevy.workspace = true`) yet - a
  known gap for workspace-structured projects.
- Reads the toolchain version from `rust-toolchain.toml`/`rust-toolchain`
  if pinned, otherwise reports `stable`.
- `build` runs `cargo build --release` (pass `--debug` for a debug
  build), locates the resulting binary under `target/<target?>/release/`
  (cargo's own, stable output convention), and optionally copies it to
  `--outputPath`.
- `test` runs `cargo test --release`.
- `--locked` defaults to `true` (fail instead of silently updating
  `Cargo.lock`) - flip it off if your CI intentionally wants to resolve
  fresh dependency versions.
- Cross-compilation via `--target` assumes the target's toolchain and any
  required linkers are already installed (e.g. via `rustup target add`,
  or a `cross`-based custom Docker image) - this plugin doesn't set that
  up for you.

## Options

| Option          | Applies to  | Description                                                  |
| ----------------- | ------------- | ---------------------------------------------------------------- |
| `--target`       | build, test | Rust target triple. Builds for the host toolchain when omitted. |
| `--features`     | build, test | Comma-separated cargo features to enable.                     |
| `--locked`       | build, test | Fail instead of updating `Cargo.lock`. Default `true`.         |
| `--debug`        | build       | Build in debug mode instead of `--release`. Default `false`.   |
| `--outputPath`   | build       | Directory to copy the built binary into.                       |
