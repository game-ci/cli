/**
 * Live Show / Automated Demo plugin - DRAFT.
 *
 * Plan: `game-ci live-show <buildPath>` runs a scripted or AI-driven
 * attract-mode playthrough on a loop, auto-restarting on crash and
 * optionally streaming output (RTMP/Discord/Twitch). Doubles as an
 * unattended long-duration soak test, since it's exercising the game
 * continuously.
 *
 * NOTE: `live-show` is not yet registered as a core CLI command.
 */

export const liveShowPlugin = {
  name: "live-show",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "live-show") {
          return {
            name: "Live show",
            async configureOptions() {
              // TODO: register --script (input-replay/AI-driver source), --streamUrl, --restartOnCrash.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Live Show / Automated Demo is not implemented yet (draft plugin), and `live-show` " +
                  "is not yet registered as a core command either. See plugins/live-show/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default liveShowPlugin;
