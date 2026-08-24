/**
 * Screen Capture & Visual Regression plugin - DRAFT (GPU-required).
 *
 * Plan: `game-ci capture <buildPath> --baseline <dir>` launches the built
 * player, captures screenshots/video at defined checkpoints, and diffs
 * against a maintained baseline to catch visual regressions - QA
 * evidence, deliberately distinct in purpose from marketing-asset
 * screenshot generation (a different, unrelated capability). Requires a
 * GPU-capable runner, unlike most of this batch.
 *
 * NOTE: `capture` is not yet registered as a core CLI command.
 */

export const screenCapturePlugin = {
  name: "screen-capture",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "capture") {
          return {
            name: "Screen capture",
            async configureOptions() {
              // TODO: register --baseline, --diffThreshold, --outputDir.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Screen Capture & Visual Regression is not implemented yet (draft plugin), and " +
                  "`capture` is not yet registered as a core command either. See plugins/screen-capture/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default screenCapturePlugin;
