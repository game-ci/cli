import { isRustProject, readRustToolchainVersion } from "./rust-project-detector";
import { RustBuildCommand } from "./rust-build-command";
import { RustTestCommand } from "./rust-test-command";

/**
 * Rust engine plugin - detects any Cargo project and builds/tests it via
 * `cargo build --release`/`cargo test --release`. Engine-agnostic
 * *within* Rust: Bevy, macroquad, ggez, Fyrox, or plain wgpu/winit all
 * build the same way (there's no engine-specific build tool the way
 * Unity/Godot/Unreal each have one) - this doesn't attempt to detect
 * which framework a project uses, only that it's a buildable Rust crate.
 *
 * Not loaded by default - opt in with `--plugin @game-ci/rust`.
 */
export const rustPlugin = {
  name: "rust",
  version: "0.1.0",

  engineDetectors: [
    {
      name: "rust",
      detect(projectPath: string) {
        if (isRustProject(projectPath)) {
          return { engine: "rust", engineVersion: readRustToolchainVersion(projectPath) };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: "rust",
      createCommand(command: string, _subCommands: string[]) {
        switch (command) {
          case "build":
            return new RustBuildCommand();
          case "test":
            return new RustTestCommand();
          default:
            return null;
        }
      },
    },
  ],
};

export default rustPlugin;
export { RustBuildCommand } from "./rust-build-command";
export { RustTestCommand } from "./rust-test-command";
export { CargoRunner, cargoBuildArgs, cargoTestArgs, cargoOutputDir, binaryFileName } from "./cargo-runner";
export {
  isRustProject,
  readCargoToml,
  readCargoPackageName,
  readCargoPackageVersion,
  readRustToolchainVersion,
} from "./rust-project-detector";
