import { describe, it, expect } from "vitest";
import { parseRuntimeTestResults, summarizeRuntimeTestResults } from "./runtime-test-results";

describe("parseRuntimeTestResults", () => {
  it("parses a valid results file", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      tests: [
        { name: "spawns player at origin", passed: true, durationMs: 12 },
        { name: "inventory persists across scene load", passed: false, message: "expected 3 items, got 2" },
      ],
    });

    const results = parseRuntimeTestResults(raw);

    expect(results.tests).toHaveLength(2);
    expect(results.tests[0].passed).toBe(true);
    expect(results.tests[1].message).toBe("expected 3 items, got 2");
  });

  it("rejects invalid JSON with a clear error", () => {
    expect(() => parseRuntimeTestResults("{not json")).toThrow(/not valid JSON/);
  });

  it('rejects a results object with no "tests" array', () => {
    expect(() => parseRuntimeTestResults(JSON.stringify({ schemaVersion: 1 }))).toThrow(/"tests" array/);
  });

  it('rejects a test entry missing a boolean "passed"', () => {
    const raw = JSON.stringify({ schemaVersion: 1, tests: [{ name: "x" }] });

    expect(() => parseRuntimeTestResults(raw)).toThrow(/boolean "passed"/);
  });
});

describe("summarizeRuntimeTestResults", () => {
  it("counts passed/failed and lists only the failures", () => {
    const results = {
      schemaVersion: 1,
      tests: [
        { name: "a", passed: true },
        { name: "b", passed: false, message: "boom" },
        { name: "c", passed: true },
      ],
    };

    const summary = summarizeRuntimeTestResults(results);

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.failures).toEqual([{ name: "b", passed: false, message: "boom" }]);
  });

  it("handles zero tests without error", () => {
    const summary = summarizeRuntimeTestResults({ schemaVersion: 1, tests: [] });

    expect(summary.total).toBe(0);
    expect(summary.failed).toBe(0);
  });
});
