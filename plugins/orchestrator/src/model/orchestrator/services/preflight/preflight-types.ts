/**
 * Type definitions for the preflight tests framework.
 *
 * Preflight tests are fast, no-engine validation gates that run BEFORE
 * expensive build stages. They are fail-fast by design -- the first
 * failing check aborts the suite. This contrasts with the test-workflow
 * engine, which fails-forward to surface every failure for maximum
 * feedback per run.
 *
 * Users can:
 *   - Reference built-in checks by ID (string entries in `checks`)
 *   - Define custom checks inline (object entries in `checks`)
 *   - Import community-published suites and overlay their own additions
 */

export type PreflightCategory = 'config' | 'environment' | 'integrity' | 'compilation';

/**
 * Optional gating predicate for a check.
 *
 * `paths` -- glob-style path prefixes (e.g. `Assets/**`). The check runs only
 * when the changed-file set intersects one of these prefixes.
 *
 * `runCondition`:
 *   - 'always'    : execute unconditionally (default).
 *   - 'on-change' : execute only if `paths` matched the changed-file set.
 *   - any other string is treated as a free-form host hint that runners may
 *     interpret (e.g. branch name, environment label). Unrecognised values
 *     fall back to 'always'.
 */
export interface PreflightScope {
  paths?: string[];
  runCondition?: 'always' | 'on-change' | string;
}

/**
 * A single preflight check definition.
 *
 * Resolved checks share this shape regardless of whether they came from the
 * built-in registry or an inline custom entry.
 */
export interface PreflightCheck {
  id: string;
  name: string;
  description: string;
  category: PreflightCategory;
  command: string;
  /** Per-check timeout in seconds. Defaults to 60s when omitted. */
  timeout?: number;
  scope?: PreflightScope;
  /**
   * Host-platform restriction. Values match `process.platform`:
   * 'win32', 'linux', 'darwin'. When omitted, the check runs on any host.
   */
  platforms?: string[];
}

/**
 * Suite definition as it appears on disk.
 *
 * `checks` may mix two forms:
 *   - string: reference to a built-in check by `id`
 *   - object: an inline `PreflightCheck` definition (full or partial; missing
 *     fields fall back to sensible defaults during resolution)
 */
export interface PreflightSuiteDefinition {
  name: string;
  description?: string;
  checks: (string | PreflightCheck)[];
}

export interface PreflightResult {
  checkId: string;
  name: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
  /** True when the check was filtered out (scope/platform) and never executed. */
  skipped?: boolean;
  skipReason?: string;
}

export interface PreflightSuiteResult {
  passed: boolean;
  results: PreflightResult[];
  duration: number;
  /**
   * Index of the check that aborted the suite, when `passed === false`.
   * Undefined when the suite completed without failures.
   */
  failedAt?: number;
}
