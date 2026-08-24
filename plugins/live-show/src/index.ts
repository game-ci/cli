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

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      "[game-ci] WARNING: @game-ci/live-show is an EXPERIMENTAL draft plugin. " +
        "Its structure is real but its domain logic is not implemented - any command it " +
        "claims will throw. Do not depend on it. See plugins/live-show/README.md.",
    );
  },

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
