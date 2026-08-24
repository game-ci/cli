/**
 * The result-file contract a built player writes for `game-ci test-runtime`
 * to read. This plugin never runs test code itself - it launches the
 * player, tells it (via environment variables) where to write results,
 * and reports on whatever comes back. Writing the actual in-game harness
 * that produces this file is the game project's responsibility; this is
 * the machine-readable format it needs to produce.
 *
 * Schema (schemaVersion 1):
 * {
 *   "schemaVersion": 1,
 *   "tests": [
 *     { "name": "string", "passed": true, "durationMs": 123, "message": "optional" }
 *   ]
 * }
 */

export interface RuntimeTestResult {
  name: string;
  passed: boolean;
  durationMs?: number;
  message?: string;
}

export interface RuntimeTestResults {
  schemaVersion: number;
  tests: RuntimeTestResult[];
}

export interface RuntimeTestSummary {
  total: number;
  passed: number;
  failed: number;
  failures: RuntimeTestResult[];
}

export function parseRuntimeTestResults(raw: string): RuntimeTestResults {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Runtime test results file is not valid JSON: ${error.message}`);
  }

  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as any).tests)) {
    throw new Error('Runtime test results file must be an object with a "tests" array.');
  }

  const results = parsed as RuntimeTestResults;

  for (const test of results.tests) {
    if (typeof test.name !== "string" || typeof test.passed !== "boolean") {
      throw new Error('Each entry in "tests" must have a string "name" and a boolean "passed".');
    }
  }

  return results;
}

export function summarizeRuntimeTestResults(results: RuntimeTestResults): RuntimeTestSummary {
  const failures = results.tests.filter((test) => !test.passed);

  return {
    total: results.tests.length,
    passed: results.tests.length - failures.length,
    failed: failures.length,
    failures,
  };
}
