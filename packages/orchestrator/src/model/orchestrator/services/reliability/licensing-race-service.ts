import * as crypto from 'node:crypto';
import * as core from '@actions/core';

export interface LicensingStaggerConfig {
  enabled: boolean;
  minDelayMs: number;
  maxDelayMs: number;
}

/**
 * Mitigates licensing race conditions when multiple Unity instances
 * launch on the same host and contend on the licensing IPC mutex.
 *
 * Detection: exit -1 + "Access token is unavailable" + runtime < 120s
 *            + no compile errors + no crash evidence.
 *
 * Mitigation 1: Hash-based stagger delay before Unity launch (5-20s based
 *               on workspace path or runner ID).
 * Mitigation 2: Retry loop with 60s delay between attempts (handled by
 *               UnityRetryService via the 'retry-licensing' recovery action).
 */
export class LicensingRaceService {
  private static readonly DEFAULT_MIN_DELAY_MS = 5_000;
  private static readonly DEFAULT_MAX_DELAY_MS = 20_000;

  /**
   * Detect whether a Unity failure looks like a licensing race condition.
   */
  static isLicensingRace(exitCode: number, runtimeSeconds: number, logText: string): boolean {
    if (exitCode !== -1 && exitCode !== 4294967295) return false;
    if (runtimeSeconds >= 120) return false;
    if (!/Access token is unavailable|Failed to update license/i.test(logText)) return false;
    if (/error CS\d{4}:/i.test(logText)) return false;
    if (
      /Segmentation fault|SIGSEGV|AccessViolationException|ErrorInvalidPPtrCast|Crash!!!/i.test(
        logText,
      )
    ) {
      return false;
    }

    return true;
  }

  /**
   * Compute a deterministic stagger delay based on workspace path or runner name.
   * The delay is hash-derived so the same runner always gets the same offset,
   * spreading concurrent launches across the delay window.
   */
  static computeStaggerDelay(config: LicensingStaggerConfig): number {
    if (!config.enabled) return 0;

    const seed =
      process.env.RUNNER_WORKSPACE ||
      process.env.RUNNER_NAME ||
      process.env.GITHUB_WORKSPACE ||
      process.cwd();

    const hash = crypto.createHash('md5').update(seed).digest();
    // Use first 4 bytes as unsigned 32-bit integer
    const hashValue = hash.readUInt32LE(0);
    const range = config.maxDelayMs - config.minDelayMs;
    const delayMs = config.minDelayMs + (hashValue % (range + 1));

    return delayMs;
  }

  /**
   * Apply the stagger delay before Unity launch.
   * Logs the delay for observability.
   */
  static async applyStaggerDelay(config: LicensingStaggerConfig): Promise<number> {
    const delayMs = LicensingRaceService.computeStaggerDelay(config);
    if (delayMs <= 0) return 0;

    core.info(
      `[LicensingRace] Applying ${delayMs}ms stagger delay to avoid licensing mutex contention`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return delayMs;
  }

  /**
   * Create default config. Reads from environment / action inputs.
   */
  static createConfig(enabled?: boolean): LicensingStaggerConfig {
    return {
      enabled: enabled ?? true,
      minDelayMs: LicensingRaceService.DEFAULT_MIN_DELAY_MS,
      maxDelayMs: LicensingRaceService.DEFAULT_MAX_DELAY_MS,
    };
  }
}
