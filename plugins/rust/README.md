> **EXPERIMENTAL.** Functional, but not published to npm and never loaded
> unless you pass `--plugin @game-ci/rust` explicitly.

# @game-ci/rust

Builds and tests any Rust game via `cargo` - engine-agnostic *within*
Rust: [Bevy](https://bevyengine.org/), [macroquad](https://macroquad.rs/),
[ggez](https://ggez.rs/), [Fyrox](https://fyrox.rs/), or plain
wgpu/winit all build the same way. There's no engine-specific build tool
the way Unity/Godot/Unreal each have one, so this plugin doesn't attempt
to detect which framework a project uses - only that it's a buildable
Rust crate (a `Cargo.toml` at the project root).

## Usage

```bash
game-ci --plugin @game-ci/rust build ./my-game --target x86_64-pc-windows-gnu
game-ci --plugin @game-ci/rust test ./my-game
```

- Detects a Rust project via `Cargo.toml`; reads the toolchain version
  from `rust-toolchain.toml`/`rust-toolchain` if pinned, otherwise
  reports `stable`.
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
