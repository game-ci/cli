import { SteamWorkshopCommand } from "./steam-workshop-command";

/**
 * Steam Workshop deploy plugin - `game-ci deploy steam-workshop <itemPath>`.
 *
 * Uploads a Workshop item (a mod, map, or asset pack) via SteamCMD's
 * workshop_build_item.vdf - a genuinely different upload target and VDF
 * schema from @game-ci/steam-deploy's full-game appbuild.vdf. Registered
 * with engine: '*' (see PluginRegistry.createCommand's wildcard
 * handling), mirroring steam-deploy's dispatch shape - reuses core's
 * existing `deploy <target>` command registration.
 */
export const steamWorkshopPlugin = {
  name: "steam-workshop",
  version: "0.1.0",

  commands: [
    {
      engine: "*",
      createCommand(command: string, subCommands: string[]) {
        if (command === "deploy" && subCommands[0] === "steam-workshop") {
          console.warn(
            "[game-ci] WARNING: `deploy steam-workshop` is EXPERIMENTAL. Verify against a test item " +
              "before pointing it at a live one.",
          );
          return new SteamWorkshopCommand();
        }
        return null;
      },
    },
  ],
};

export default steamWorkshopPlugin;
export { SteamWorkshopCommand } from "./steam-workshop-command";
export { generateWorkshopItemVdf } from "./workshop-vdf-generator";
export { parseWorkshopOutput } from "./parse-workshop-output";
export { WorkshopCmdRunner } from "./workshop-cmd-runner";
