import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import {
  UnityBuildDiagnosticsService,
  UnityFailureCategory,
  UnityRunDiagnostics,
} from './unity-build-diagnostics-service';
import { UnityRecoveryService, UnityRecoveryBudgets } from './unity-recovery-service';
import { BuildReliabilityService } from './build-reliability-service';

export interface UnityRetryResult {
  succeeded: boolean;
  attempts: number;
  lastDiagnostics: UnityRunDiagnostics;
  actionsPerformed: string[];
}

type UnityRunCallback = () => Promise<{
  exitCode: number;
  logText: string;
  runtimeSeconds: number;
}>;

/**
 * Multi-phase retry service that chains recovery actions based on failure category.
 *
 * Retry chains by category:
 * - CRASH: backup Library -> clear ScriptAssemblies (or full nuke if crash evidence dense) -> retry
 * - COMPILE with GUID: retry once (partial fix), then clear PackageCache + ScriptAssemblies -> retry
 * - LICENSE: wait 60s -> retry (up to 4 times)
 *
 * Circuit breaker: uses budget-based limits per category from UnityRecoveryService.
 */
export class UnityRetryService {
  private static readonly MAX_TOTAL_RETRIES = 5;

  /**
   * Execute a Unity run with automatic multi-phase retry on failure.
   * The `runUnity` callback is invoked for each attempt and must return
   * the exit code, log text, and runtime.
   */
  static async executeWithRetry(
    projectPath: string,
    runUnity: UnityRunCallback,
    options: {
      buildMethodPattern?: RegExp;
      maxRetries?: number;
      budgets?: UnityRecoveryBudgets;
    } = {},
  ): Promise<UnityRetryResult> {
    const maxRetries = Math.min(
      options.maxRetries ?? UnityRetryService.MAX_TOTAL_RETRIES,
      UnityRetryService.MAX_TOTAL_RETRIES,
    );
    const budgets = options.budgets ?? UnityRecoveryService.createDefaultBudgets();
    const actionsPerformed: string[] = [];
    let attempts = 0;
    let lastDiagnostics: UnityRunDiagnostics | undefined;

    while (attempts <= maxRetries) {
      attempts++;
      core.info(`[UnityRetry] Attempt ${attempts}/${maxRetries + 1}`);

      const result = await runUnity();

      const diagnostics = UnityBuildDiagnosticsService.analyzeRun({
        exitCode: result.exitCode,
        runtimeSeconds: result.runtimeSeconds,
        logText: result.logText,
        projectPath,
        buildMethodPattern: options.buildMethodPattern,
      });

      lastDiagnostics = diagnostics;
      UnityBuildDiagnosticsService.emitSummary(diagnostics);

      if (diagnostics.failureCategory === 'SUCCESS') {
        core.info(`[UnityRetry] Succeeded on attempt ${attempts}`);
        return { succeeded: true, attempts, lastDiagnostics: diagnostics, actionsPerformed };
      }

      if (attempts > maxRetries) break;

      const decision = UnityRecoveryService.decide(diagnostics, budgets);
      if (!decision.shouldRetry) {
        core.info(`[UnityRetry] No retry available: ${decision.reason}`);
        break;
      }

      core.info(`[UnityRetry] Recovery action: ${decision.action} -- ${decision.reason}`);
      actionsPerformed.push(decision.action);

      // Perform recovery based on category
      await UnityRetryService.performRecovery(
        projectPath,
        diagnostics,
        decision.clearSubfolders,
        decision.nukeLibrary,
        decision.delaySeconds,
      );
    }

    core.warning(
      `[UnityRetry] Failed after ${attempts} attempt(s). Category: ${lastDiagnostics?.failureCategory ?? 'UNKNOWN'}`,
    );
    return {
      succeeded: false,
      attempts,
      lastDiagnostics: lastDiagnostics!,
      actionsPerformed,
    };
  }

  private static async performRecovery(
    projectPath: string,
    diagnostics: UnityRunDiagnostics,
    clearSubfolders: string[],
    nukeLibrary: boolean,
    delaySeconds: number,
  ): Promise<void> {
    // Delay (for licensing race retries)
    if (delaySeconds > 0) {
      core.info(`[UnityRetry] Waiting ${delaySeconds}s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }

    const libraryPath = path.join(projectPath, 'Library');

    if (nukeLibrary) {
      // Backup Library before nuking to prevent death spiral
      UnityRetryService.backupLibrary(projectPath);
      BuildReliabilityService.removeDirectoryWithRetry(libraryPath);
      core.info('[UnityRetry] Library nuked');
      return;
    }

    // CRASH recovery: check crash density to decide ScriptAssemblies-only vs broader nuke
    if (diagnostics.failureCategory === 'CRASH') {
      const crashPatternCount = diagnostics.matchedPatterns.length;

      if (crashPatternCount >= 3) {
        // Dense crash evidence: backup and nuke Library
        UnityRetryService.backupLibrary(projectPath);
        BuildReliabilityService.removeDirectoryWithRetry(libraryPath);
        core.info('[UnityRetry] Dense crash evidence -- Library nuked');
        return;
      }

      // Light crash evidence: clear ScriptAssemblies only
      BuildReliabilityService.clearScriptAssemblies(projectPath);
      core.info('[UnityRetry] Cleared ScriptAssemblies after crash');
      return;
    }

    // Clear specified subfolders
    for (const subfolder of clearSubfolders) {
      if (subfolder === 'Library') {
        UnityRetryService.backupLibrary(projectPath);
        BuildReliabilityService.removeDirectoryWithRetry(libraryPath);
      } else {
        BuildReliabilityService.removeDirectoryWithRetry(path.join(libraryPath, subfolder));
      }
      core.info(`[UnityRetry] Cleared ${subfolder}`);
    }

    // COMPILE+GUID: also clear ScriptAssemblies alongside PackageCache
    if (diagnostics.guidErrors && !clearSubfolders.includes('ScriptAssemblies')) {
      BuildReliabilityService.clearScriptAssemblies(projectPath);
      core.info('[UnityRetry] Cleared ScriptAssemblies (GUID compile errors)');
    }
  }

  private static backupLibrary(projectPath: string): void {
    const libraryPath = path.join(projectPath, 'Library');
    if (!fs.existsSync(libraryPath)) return;

    const backupPath = path.join(projectPath, `Library.backup-${Date.now()}`);
    try {
      fs.renameSync(libraryPath, backupPath);
      core.info(`[UnityRetry] Library backed up to ${backupPath}`);
    } catch (error: any) {
      core.warning(`[UnityRetry] Library backup failed: ${error.message}`);
    }
  }
}
