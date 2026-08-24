/**
 * itch.io deploy plugin - DRAFT.
 *
 * Plan: `game-ci deploy itch <buildPath> --user --game --channel`,
 * wrapping itch.io's official `butler push` CLI. Structurally identical
 * to @game-ci/steam-deploy (engine-agnostic, dispatched via the '*'
 * engine wildcard on the `deploy` command) - butler's actual invocation
 * shape and channel-naming conventions need verification before this is
 * functional.
 */

export const itchDeployPlugin = {
  name: "itch-deploy",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, subCommands: string[]) {
        if (command === "deploy" && subCommands[0] === "itch") {
          return {
            name: "Deploy itch",
            async configureOptions() {
              // TODO: register --user, --game, --channel options, matching
              // butler's <user>/<game>:<channel> target format.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "itch.io deploy is not implemented yet (draft plugin). " +
                  "See plugins/itch-deploy/README.md for the planned `butler push` invocation.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default itchDeployPlugin;
