import * as os from "node:os";
import * as path from "node:path";
import { resolvePlayerExecutable } from "./resolve-player-executable";
import { launchAndCollectResults } from "./launch-and-collect-results";
import { summarizeRuntimeTestResults } from "./runtime-test-results";

export interface RuntimeTestOptions {
  buildPath?: string;
  timeout?: number;
  resultsPath?: string;
  args?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

export class RuntimeTestCommand {
  public readonly name = "Test runtime";

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("timeout", {
        describe: "Milliseconds to wait for the player to exit before killing it and failing the run",
        type: "number",
        default: 60_000,
      })
      .option("resultsPath", {
        describe: "Where the player should write its results file. Defaults to a temp file, deleted after reading.",
        type: "string",
      })
      .option("args", {
        describe: "Extra arguments to pass through to the player process, space-separated",
        type: "string",
      });
  }

  public async execute(options: RuntimeTestOptions): Promise<boolean> {
    const buildPath = options.buildPath;
    if (!buildPath) {
      throw new Error("A build path is required: game-ci test-runtime <buildPath>");
    }

    const resultsPath =
      options.resultsPath ?? path.join(os.tmpdir(), `game-ci-runtime-test-results-${Date.now()}.json`);
    const executablePath = resolvePlayerExecutable(buildPath);
    const extraArgs = options.args ? options.args.split(" ").filter(Boolean) : [];

    console.log(`Launching ${executablePath} for runtime tests (results: ${resultsPath})`);

    const { results, timedOut } = await launchAndCollectResults({
      executablePath,
      resultsPath,
      extraArgs,
      timeoutMs: options.timeout ?? 60_000,
    });

    const summary = summarizeRuntimeTestResults(results);
    console.log(`Runtime tests: ${summary.passed}/${summary.total} passed`);

    if (summary.failed > 0) {
      for (const failure of summary.failures) {
        console.error(`  FAIL: ${failure.name}${failure.message ? ` — ${failure.message}` : ""}`);
      }
      throw new Error(`${summary.failed} runtime test(s) failed.`);
    }

    if (!timedOut && summary.total === 0) {
      console.warn("Runtime test player reported zero tests. This may indicate the in-game harness is not wired up.");
    }

    return true;
  }
}
