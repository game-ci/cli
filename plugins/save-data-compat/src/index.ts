/**
 * Save-Data Cross-Version Compatibility plugin - DRAFT.
 *
 * Plan: `game-ci test-save-compat <buildPath> --corpusPath <dir>`
 * verifies that a new build can still load a maintained corpus of real
 * historical save files without crashing or losing data - a specific,
 * well-scoped test type complementing (not overlapping) the broader
 * Runtime Test Framework idea.
 *
 * NOTE: `test-save-compat` is not yet registered as a core CLI command.
 */

export const saveDataCompatPlugin = {
  name: "save-data-compat",
  version: "0.0.1",

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      "[game-ci] WARNING: @game-ci/save-data-compat is an EXPERIMENTAL draft plugin. " +
        "Its structure is real but its domain logic is not implemented - any command it " +
        "claims will throw. Do not depend on it. See plugins/save-data-compat/README.md.",
    );
  },

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "test-save-compat") {
          return {
            name: "Test save compatibility",
            async configureOptions() {
              // TODO: register --corpusPath, --failOnDataLoss.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Save-Data Cross-Version Compatibility is not implemented yet (draft plugin), and " +
                  "`test-save-compat` is not yet registered as a core command either. See plugins/save-data-compat/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default saveDataCompatPlugin;
