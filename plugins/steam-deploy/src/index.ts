import { SteamDeployCommand } from "./steam-deploy-command";

/**
 * Steam deploy plugin - `game-ci deploy steam <buildPath>`.
 *
 * Engine-agnostic: it deploys a pre-built output folder, so it doesn't
 * matter whether Unity, Godot, Unreal, or anything else produced it.
 * Registered with engine: '*' (see PluginRegistry.createCommand's wildcard
 * handling), not tied to any specific engine's plugin.
 */
export const steamDeployPlugin = {
  name: "steam-deploy",
  version: "0.1.0",

  commands: [
    {
      engine: "*",
      createCommand(command: string, subCommands: string[]) {
        if (command === "deploy" && subCommands[0] === "steam") {
          return new SteamDeployCommand();
        }
        return null;
      },
    },
  ],
};

export default steamDeployPlugin;
export { SteamDeployCommand } from "./steam-deploy-command";
export { generateAppVdf, generateDepotVdf } from "./vdf-generator";
export { parseSteamCmdOutput } from "./parse-steamcmd-output";
export { SteamCmdRunner } from "./steamcmd-runner";
