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
          // Warned here rather than in onLoad: this plugin is in cli.ts's
          // default load list, so an onLoad warning would fire on every
          // single game-ci invocation and train people to ignore warnings.
          // This fires exactly when the experimental feature is used - and
          // a Steam upload is irreversible once it reaches a live branch.
          console.warn(
            "[game-ci] WARNING: `deploy steam` is EXPERIMENTAL. Verify against a test branch " +
              "before pointing it at a live one - a Steam upload cannot be undone.",
          );
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
