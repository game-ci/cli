/**
 * Crash-symbol upload plugin - DRAFT.
 *
 * Plan: `game-ci upload-symbols <buildPath> --service=sentry|backtrace
 * --project --authToken`, uploading platform-specific debug symbols
 * (dSYM on macOS/iOS, PDB on Windows, breakpad .sym elsewhere) so a
 * crash-reporting service can symbolicate stack traces from production
 * crashes. Engine-agnostic, same '*' wildcard shape as deploy plugins.
 *
 * NOTE: `upload-symbols` is not yet registered as a core CLI command
 * (unlike `deploy`, which game-ci/cli#123 added) - this plugin cannot
 * actually be invoked yet even once its logic is implemented, without a
 * follow-up core change adding that yargs command registration.
 */

export const crashSymbolUploadPlugin = {
  name: "crash-symbol-upload",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "upload-symbols") {
          return {
            name: "Upload symbols",
            async configureOptions() {
              // TODO: register --service, --project, --authToken (env-var preferred for the token).
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Crash-symbol upload is not implemented yet (draft plugin), and `upload-symbols` " +
                  "is not yet registered as a core command either. See plugins/crash-symbol-upload/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default crashSymbolUploadPlugin;
