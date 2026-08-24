import { RuntimeTestCommand } from "./runtime-test-command";

/**
 * Runtime Test Framework plugin - `game-ci test-runtime <buildPath>`.
 *
 * Launches the actual *built player* (not the Editor, and not Unity's own
 * Test Framework's specialized test player) and runs whatever tests its
 * in-game harness reports on, via a small results-file contract this
 * plugin defines (see runtime-test-results.ts) - distinct from
 * `game-ci test`'s existing `-runTests` path, which only ever exercises
 * Unity's own Test Framework assemblies, never a project's real shipped
 * build. GPU-free by design; engine-agnostic (any built executable that
 * honors the results contract works, not just Unity).
 */
export const runtimeTestFrameworkPlugin = {
  name: "runtime-test-framework",
  version: "0.1.0",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "test-runtime") {
          return new RuntimeTestCommand();
        }
        return null;
      },
    },
  ],
};

export default runtimeTestFrameworkPlugin;
export { RuntimeTestCommand } from "./runtime-test-command";
export { resolvePlayerExecutable } from "./resolve-player-executable";
export { launchAndCollectResults } from "./launch-and-collect-results";
export { parseRuntimeTestResults, summarizeRuntimeTestResults } from "./runtime-test-results";
export type { RuntimeTestResult, RuntimeTestResults, RuntimeTestSummary } from "./runtime-test-results";
