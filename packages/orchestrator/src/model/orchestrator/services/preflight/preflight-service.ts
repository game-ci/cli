import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import * as core from '@actions/core';
import YAML from 'yaml';
import { builtInChecks } from './built-in-checks';
import {
  PreflightCheck,
  PreflightResult,
  PreflightSuiteDefinition,
  PreflightSuiteResult,
} from './preflight-types';

const execAsync = promisify(exec);

const DEFAULT_SUITE_PATH = '.game-ci/preflight-suite.yml';
const DEFAULT_CHECK_TIMEOUT_SECONDS = 60;

/**
 * Preflight tests engine -- a thin gating wrapper over a process executor.
 *
 * Preflight differs from the test-workflow engine in two ways:
 *   1. It does not need an engine (Unity / Godot / etc.) -- checks are shell
 *      commands or node scripts, fast enough to run before any heavy stage.
 *   2. It is fail-fast: the first failing check aborts the suite and signals
 *      the caller to skip downstream build dispatch. The test-workflow engine
 *      fails-forward to surface every failure in one run.
 */
export class PreflightService {
  /**
   * Load a suite from disk. If `suitePath` is omitted, falls back to the
   * project-default location (`.game-ci/preflight-suite.yml`). When neither
   * a custom path nor the default file exists, returns a built-in
   * minimal suite that runs the safest no-op checks.
   */
  static loadSuite(suitePath?: string): PreflightSuiteDefinition {
    const candidate = suitePath ?? DEFAULT_SUITE_PATH;

    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf8');
      const parsed = YAML.parse(content);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Invalid YAML in preflight suite file: ${candidate}`);
      }

      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error(`Preflight suite must have a 'name' field (string): ${candidate}`);
      }

      if (!Array.isArray(parsed.checks) || parsed.checks.length === 0) {
        throw new Error(`Preflight suite must have a non-empty 'checks' array: ${candidate}`);
      }

      return {
        name: parsed.name,
        description: parsed.description,
        checks: parsed.checks,
      };
    }

    if (suitePath) {
      throw new Error(`Preflight suite file not found: ${suitePath}`);
    }

    // No user-supplied path and no default file present -- return a minimal
    // built-in default suite. This keeps preflight opt-in but non-fatal for
    // projects that haven't authored a suite yet.
    return {
      name: 'default',
      description: 'Default preflight suite (no suite file found).',
      checks: ['runner-health', 'config-validation'],
    };
  }

  /**
   * Resolve a suite's mixed string/object check entries to concrete
   * `PreflightCheck` objects. String entries look up the built-in registry;
   * objects are validated and normalised.
   */
  static resolveChecks(suite: PreflightSuiteDefinition): PreflightCheck[] {
    const resolved: PreflightCheck[] = [];

    for (const entry of suite.checks) {
      if (typeof entry === 'string') {
        const builtIn = builtInChecks.get(entry);
        if (!builtIn) {
          throw new Error(
            `Unknown built-in preflight check: '${entry}'. ` +
              `Available IDs: ${[...builtInChecks.keys()].join(', ')}`,
          );
        }
        resolved.push({ ...builtIn });
        continue;
      }

      if (!entry || typeof entry !== 'object') {
        throw new Error(`Each preflight check must be a string ID or an object definition.`);
      }

      const errors = PreflightService.validateCheck(entry);
      if (errors.length > 0) {
        throw new Error(`Invalid preflight check definition:\n  ${errors.join('\n  ')}`);
      }

      resolved.push({ ...entry });
    }

    return resolved;
  }

  /**
   * Execute a single check with timeout enforcement. The check is considered
   * passed iff the child process exits with code 0.
   */
  static async executeCheck(check: PreflightCheck): Promise<PreflightResult> {
    if (
      check.platforms &&
      check.platforms.length > 0 &&
      !check.platforms.includes(process.platform)
    ) {
      core.info(
        `[Preflight] Skipping '${check.id}' -- platform ${process.platform} not in [${check.platforms.join(', ')}]`,
      );
      return {
        checkId: check.id,
        name: check.name,
        passed: true,
        duration: 0,
        skipped: true,
        skipReason: `Platform ${process.platform} not in supported list`,
      };
    }

    const timeoutSeconds = check.timeout ?? DEFAULT_CHECK_TIMEOUT_SECONDS;
    const timeoutMs = timeoutSeconds * 1000;

    core.info(`[Preflight] Starting check: '${check.id}' (${check.name})`);
    core.info(`[Preflight] Command: ${check.command}`);

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(check.command, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        cwd: process.cwd(),
      });

      const duration = (Date.now() - startTime) / 1000;
      core.info(`[Preflight] Check '${check.id}' passed in ${duration.toFixed(2)}s`);

      return {
        checkId: check.id,
        name: check.name,
        passed: true,
        duration,
        output: stdout || stderr || undefined,
      };
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      const isTimeout = error.killed === true || error.signal === 'SIGTERM';

      const message = isTimeout
        ? `Check timed out after ${timeoutSeconds}s`
        : (error.message ?? 'Unknown execution error');

      core.error(`[Preflight] Check '${check.id}' failed in ${duration.toFixed(2)}s: ${message}`);

      return {
        checkId: check.id,
        name: check.name,
        passed: false,
        duration,
        output: error.stdout ?? undefined,
        error: error.stderr ? `${message}\n${error.stderr}` : message,
      };
    }
  }

  /**
   * Execute all checks in a suite, in order, fail-fast on first failure.
   *
   * Unlike `TestWorkflowService.executeTestSuite`, this method aborts as
   * soon as a check fails. Subsequent checks are not executed -- their
   * absence from `results` is intentional and tells the caller that the
   * suite was cut short.
   */
  static async executeSuite(suite: PreflightSuiteDefinition): Promise<PreflightSuiteResult> {
    core.info(`[Preflight] Executing suite '${suite.name}'`);
    if (suite.description) {
      core.info(`[Preflight] ${suite.description}`);
    }

    const checks = PreflightService.resolveChecks(suite);
    core.info(`[Preflight] Resolved ${checks.length} check(s)`);

    const results: PreflightResult[] = [];
    const suiteStart = Date.now();

    for (let index = 0; index < checks.length; index++) {
      const check = checks[index];
      const result = await PreflightService.executeCheck(check);
      results.push(result);

      if (!result.passed) {
        const totalDuration = (Date.now() - suiteStart) / 1000;
        core.error(
          `[Preflight] Suite '${suite.name}' aborted at check '${check.id}' (${index + 1}/${checks.length})`,
        );

        return {
          passed: false,
          results,
          duration: totalDuration,
          failedAt: index,
        };
      }
    }

    const totalDuration = (Date.now() - suiteStart) / 1000;
    core.info(`[Preflight] Suite '${suite.name}' passed in ${totalDuration.toFixed(2)}s`);

    return {
      passed: true,
      results,
      duration: totalDuration,
    };
  }

  /**
   * Emit results to the console and (when running under GitHub Actions) as
   * annotations + a markdown summary table.
   */
  static reportResults(results: PreflightSuiteResult): void {
    const summary = PreflightService.generateSummaryMarkdown(results);
    core.info(summary);

    for (const result of results.results) {
      if (result.skipped) {
        continue;
      }
      if (!result.passed) {
        core.error(
          `Preflight check '${result.checkId}' failed: ${result.error ?? 'no error message'}`,
        );
      }
    }

    // GitHub Actions step summary -- best-effort, ignored outside CI.
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      try {
        fs.appendFileSync(summaryFile, `${summary}\n`, 'utf8');
      } catch (error: any) {
        core.warning(`[Preflight] Failed to write GITHUB_STEP_SUMMARY: ${error.message}`);
      }
    }
  }

  /**
   * Generate a markdown summary table for the suite result.
   */
  static generateSummaryMarkdown(results: PreflightSuiteResult): string {
    const lines: string[] = [];
    lines.push('## Preflight Results');
    lines.push('');
    lines.push(`Status: ${results.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`Duration: ${results.duration.toFixed(2)}s`);
    lines.push('');
    lines.push('| Status | Check | Duration | Notes |');
    lines.push('|--------|-------|----------|-------|');

    for (const result of results.results) {
      let status: string;
      if (result.skipped) {
        status = 'SKIP';
      } else if (result.passed) {
        status = 'PASS';
      } else {
        status = 'FAIL';
      }
      const notes = result.skipped ? (result.skipReason ?? 'skipped') : (result.error ?? '');
      lines.push(
        `| ${status} | ${result.name} (\`${result.checkId}\`) | ${result.duration.toFixed(2)}s | ${notes.split('\n')[0]} |`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Validate a custom check definition. Returns an array of error messages
   * (empty = valid). Used by `resolveChecks` to reject malformed inline
   * definitions before execution.
   */
  private static validateCheck(check: any): string[] {
    const errors: string[] = [];

    if (!check.id || typeof check.id !== 'string') {
      errors.push(`Check is missing required 'id' field (string)`);
    }
    if (!check.name || typeof check.name !== 'string') {
      errors.push(`Check '${check.id ?? '<unknown>'}' is missing required 'name' field (string)`);
    }
    if (!check.description || typeof check.description !== 'string') {
      errors.push(
        `Check '${check.id ?? '<unknown>'}' is missing required 'description' field (string)`,
      );
    }
    if (!check.command || typeof check.command !== 'string') {
      errors.push(
        `Check '${check.id ?? '<unknown>'}' is missing required 'command' field (string)`,
      );
    }
    if (
      !check.category ||
      !['config', 'environment', 'integrity', 'compilation'].includes(check.category)
    ) {
      errors.push(
        `Check '${check.id ?? '<unknown>'}' has invalid 'category' -- must be one of: config, environment, integrity, compilation`,
      );
    }
    if (check.timeout !== undefined) {
      const timeout = Number(check.timeout);
      if (Number.isNaN(timeout) || timeout <= 0) {
        errors.push(`Check '${check.id ?? '<unknown>'}': 'timeout' must be a positive number`);
      }
    }

    return errors;
  }

  /**
   * Returns the resolved default suite path. Exposed primarily for tests and
   * CLI help text.
   */
  static get defaultSuitePath(): string {
    return DEFAULT_SUITE_PATH;
  }
}
