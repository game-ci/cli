import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';

/**
 * Pre-build cleanup operations that remove stale artifacts
 * which can cause false positives or destabilize builds.
 */
export class PreBuildCleanupService {
  /**
   * Delete stale test result XML files before launching the test runner.
   * Prevents false positives from previous test runs being picked up
   * as current results.
   *
   * Returns the number of files removed.
   */
  static cleanTestResults(testResultPath: string): number {
    if (!fs.existsSync(testResultPath)) {
      return 0;
    }

    let removed = 0;

    try {
      const entries = fs.readdirSync(testResultPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const ext = entry.name.toLowerCase();
        if (!ext.endsWith('.xml') && !ext.endsWith('.trx')) continue;

        const fullPath = path.join(testResultPath, entry.name);
        try {
          fs.unlinkSync(fullPath);
          removed++;
        } catch {
          core.warning(`[PreBuild] Failed to remove stale test result: ${fullPath}`);
        }
      }
    } catch (error: any) {
      core.warning(`[PreBuild] Failed to scan test results directory: ${error.message}`);
    }

    if (removed > 0) {
      core.info(`[PreBuild] Removed ${removed} stale test result file(s) from ${testResultPath}`);
    }

    return removed;
  }

  /**
   * Build the `-disable-assembly-updater` argument for Unity batchmode.
   * The ApiUpdater can destabilize CI sessions by modifying assemblies
   * mid-build. Disabling it in batchmode is the safe default.
   *
   * Returns the CLI argument string, or empty string if not applicable.
   */
  static getDisableAssemblyUpdaterArg(customParameters: string): string {
    // Don't add if user already specified it
    if (/-disable-assembly-updater/i.test(customParameters)) {
      return '';
    }

    return '-disable-assembly-updater';
  }
}
