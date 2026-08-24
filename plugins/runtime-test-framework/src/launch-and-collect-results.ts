import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { parseRuntimeTestResults, type RuntimeTestResults } from "./runtime-test-results";

export interface LaunchOptions {
  executablePath: string;
  resultsPath: string;
  /** Extra arguments passed through to the player process. */
  extraArgs?: string[];
  /** Milliseconds to wait before killing the process and treating it as a timeout. */
  timeoutMs: number;
}

export interface LaunchResult {
  results: RuntimeTestResults;
  exitCode: number | null;
  timedOut: boolean;
}

type SpawnFn = typeof spawn;

/**
 * Launches the built player with the environment variables the results
 * contract expects (GAME_CI_RUNTIME_TEST_MODE, GAME_CI_RUNTIME_TEST_RESULTS_PATH),
 * waits for it to exit (or times out and kills it), then reads and parses
 * the results file it was told to write.
 *
 * The results file - not the exit code - is the authoritative signal:
 * a player that writes valid, complete results but happens to exit
 * non-zero for an unrelated reason (a background cleanup step failing,
 * for instance) shouldn't have its actual test results discarded.
 */
export async function launchAndCollectResults(options: LaunchOptions, spawnFn: SpawnFn = spawn): Promise<LaunchResult> {
  if (fs.existsSync(options.resultsPath)) {
    fs.unlinkSync(options.resultsPath);
  }

  const child = spawnFn(options.executablePath, options.extraArgs ?? [], {
    env: {
      ...process.env,
      GAME_CI_RUNTIME_TEST_MODE: "1",
      GAME_CI_RUNTIME_TEST_RESULTS_PATH: options.resultsPath,
    },
    stdio: "inherit",
  });

  const { exitCode, timedOut } = await new Promise<{ exitCode: number | null; timedOut: boolean }>(
    (resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve({ exitCode: null, timedOut: true });
      }, options.timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code, timedOut: false });
      });
    },
  );

  if (timedOut) {
    throw new Error(
      `Runtime test player did not exit within ${options.timeoutMs}ms and was killed. ` +
        "Increase --timeout, or check whether the in-game test harness is hanging.",
    );
  }

  if (!fs.existsSync(options.resultsPath)) {
    throw new Error(
      `Runtime test player exited (code ${exitCode}) without writing a results file to ${options.resultsPath}. ` +
        "Check that the in-game test harness reads GAME_CI_RUNTIME_TEST_RESULTS_PATH and writes to it before exiting.",
    );
  }

  const raw = fs.readFileSync(options.resultsPath, "utf8");
  const results = parseRuntimeTestResults(raw);

  return { results, exitCode, timedOut };
}
