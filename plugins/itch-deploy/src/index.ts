import { ItchDeployCommand } from "./itch-deploy-command";

/**
 * itch.io deploy plugin - `game-ci deploy itch <buildPath>`.
 *
 * Engine-agnostic: it deploys a pre-built output folder, so it doesn't
 * matter whether Unity, Godot, Unreal, or anything else produced it.
 * Registered with engine: '*' (see PluginRegistry.createCommand's
 * wildcard handling), mirroring steam-deploy's dispatch shape. Not wired
 * into core's default load list.
 */
export const itchDeployPlugin = {
  name: "itch-deploy",
  version: "0.1.0",

  commands: [
    {
      engine: "*",
      createCommand(command: string, subCommands: string[]) {
        if (command === "deploy" && subCommands[0] === "itch") {
          console.warn(
            "[game-ci] WARNING: `deploy itch` is EXPERIMENTAL. Verify against a test channel " +
              "before pointing it at a live one.",
          );
          return new ItchDeployCommand();
        }
        return null;
      },
    },
  ],
};

export default itchDeployPlugin;
export { ItchDeployCommand } from "./itch-deploy-command";
export { ButlerRunner } from "./butler-runner";
