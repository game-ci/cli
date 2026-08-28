import { isBevyProject, readRustToolchainVersion } from "./bevy-project-detector";
import { BevyBuildCommand } from "./bevy-build-command";
import { BevyTestCommand } from "./bevy-test-command";

/**
 * Bevy engine plugin - detects a Bevy project (a `bevy` dependency in
 * Cargo.toml, not just any Cargo project - Rust has no single dominant
 * game engine the way Unity/Godot/Unreal do, so "any Cargo.toml" would
 * misclassify every non-game Rust crate) and builds/tests it via `cargo
 * build --release`/`cargo test --release` - Bevy has no separate build
 * tool of its own, it's a regular Cargo dependency.
 *
 * Not loaded by default - opt in with `--plugin @game-ci/bevy`.
 */
export const bevyPlugin = {
  name: "bevy",
  version: "0.1.0",

  engineDetectors: [
    {
      name: "bevy",
      detect(projectPath: string) {
        if (isBevyProject(projectPath)) {
          return { engine: "bevy", engineVersion: readRustToolchainVersion(projectPath) };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: "bevy",
      createCommand(command: string, _subCommands: string[]) {
        switch (command) {
          case "build":
            return new BevyBuildCommand();
          case "test":
            return new BevyTestCommand();
          default:
            return null;
        }
      },
    },
  ],
};

export default bevyPlugin;
export { BevyBuildCommand } from "./bevy-build-command";
export { BevyTestCommand } from "./bevy-test-command";
export { CargoRunner, cargoBuildArgs, cargoTestArgs, cargoOutputDir, binaryFileName } from "./cargo-runner";
export {
  isBevyProject,
  hasBevyDependency,
  readCargoToml,
  readCargoPackageName,
  readCargoPackageVersion,
  readRustToolchainVersion,
} from "./bevy-project-detector";
