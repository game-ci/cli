/**
 * Runtime Test Framework plugin - DRAFT.
 *
 * Plan: `game-ci test-runtime <buildPath>` launches the actual *built
 * player* (not the Editor) and runs a suite of assertion-based tests
 * against it, reporting pass/fail to CI - distinct from Unity's own Test
 * Runner (which only ever tests Editor-time code, never a real built
 * binary) and distinct from a shallow "does it boot" smoke check.
 * GPU-free by design, so it can run on ordinary CI runners.
 *
 * NOTE: `test-runtime` is not yet registered as a core CLI command - see
 * game-ci/cli#123's `deploy` addition for the precedent this needs to
 * follow.
 */

export const runtimeTestFrameworkPlugin = {
  name: "runtime-test-framework",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "test-runtime") {
          return {
            name: "Test runtime",
            async configureOptions() {
              // TODO: register --testFilter, --timeout, --reportPath, etc.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Runtime Test Framework is not implemented yet (draft plugin), and `test-runtime` " +
                  "is not yet registered as a core command either. See plugins/runtime-test-framework/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default runtimeTestFrameworkPlugin;
