/**
 * Steam Workshop / mod-publishing plugin - DRAFT.
 *
 * Plan: `game-ci deploy steam-workshop <buildPath> --appId --itemId`
 * wraps SteamCMD's workshop_build_item.vdf upload path - a genuinely
 * different VDF schema and upload target from @game-ci/steam-deploy's
 * full-game appbuild.vdf. This is for mods, maps, and asset packs, not a
 * whole game build.
 *
 * NOTE: mirrors steam-deploy's `deploy <target>` dispatch shape (already
 * registered in core - see game-ci/cli#123), so this doesn't need a new
 * core command registration, unlike most of the other drafts.
 */

export const steamWorkshopPlugin = {
  name: "steam-workshop",
  version: "0.0.1",

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      "[game-ci] WARNING: @game-ci/steam-workshop is an EXPERIMENTAL draft plugin. " +
        "Its structure is real but its domain logic is not implemented - any command it " +
        "claims will throw. Do not depend on it. See plugins/steam-workshop/README.md.",
    );
  },

  commands: [
    {
      engine: "*",
      createCommand(command: string, subCommands: string[]) {
        if (command === "deploy" && subCommands[0] === "steam-workshop") {
          return {
            name: "Deploy steam workshop",
            async configureOptions() {
              // TODO: register --appId, --itemId (omit to publish a new item),
              // --title, --description, --changeNote, --visibility, --previewImage.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Steam Workshop publishing is not implemented yet (draft plugin). " +
                  "See plugins/steam-workshop/README.md for the planned workshop_build_item.vdf shape.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default steamWorkshopPlugin;
