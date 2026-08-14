import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';

export type UnityRecoveryAction =
  | 'success'
  | 'fail'
  | 'retry-licensing'
  | 'retry-lfs-pull'
  | 'retry-package-cache'
  | 'retry-api-updater'
  | 'retry-two-phase-import'
  | 'reset-source-asset-db'
  | 'nuke-library';

export type UnityFailureCategory =
  | 'LICENSE'
  | 'CRASH'
  | 'COMPILE'
  | 'PACKAGE'
  | 'SKIP'
  | 'EXIT_NEG1'
  | 'GENERIC'
  | 'SUCCESS';

export interface UnityRunDiagnosticInput {
  exitCode: number;
  runtimeSeconds?: number;
  logText?: string;
  projectPath?: string;
  buildMethodPattern?: RegExp;
  artifactDbMtimeBeforeMs?: number;
}

export interface UnityFailureSummary {
  category: UnityFailureCategory;
  exitCode: number;
  runtimeSeconds: number;
  detectedSignals: string[];
  compileErrorCount: number;
  topCompileErrors: string[];
  remediationHint: string;
}

export interface UnityRunDiagnostics {
  exitCode: number;
  runtimeSeconds: number;
  buildMethodInvoked: boolean;
  crashEvidenceFound: boolean;
  lfsPointerDllFound: boolean;
  licensingFailure: boolean;
  guidErrors: boolean;
  packageCacheCorrupt: boolean;
  apiUpdaterRan: boolean;
  importCompleted: boolean;
  silentSuccess: boolean;
  preserveLibrary: boolean;
  nukeLibrary: boolean;
  recommendedAction: UnityRecoveryAction;
  failureCategory: UnityFailureCategory;
  failureSummary: UnityFailureSummary;
  matchedPatterns: string[];
}

export class UnityBuildDiagnosticsService {
  static readonly CRASH_EVIDENCE_PATTERNS = [
    /ErrorInvalidPPtrCast/i,
    /Segmentation fault/i,
    /SIGSEGV/i,
    /AccessViolationException/i,
    /Fatal error in Unity CIL/i,
    /Crash!!!/i,
    /Fatal Error!/i,
    /A crash has been intercepted/i,
    /EditorUtility.*:.*NullRef/i,
    /AssetDatabase.*corruption/i,
    /Native Crash Reporting/i,
    /Build asset version error/i,
    /Unity\.ILPP\.Runner.*(CLR exception|0xe0434352)/i,
  ];

  private static readonly LFS_POINTER_HEADER = 'version https://git-lfs.github.com/spec/v1';

  static analyzeRun(input: UnityRunDiagnosticInput): UnityRunDiagnostics {
    const logText = input.logText || '';
    const normalizedExitCode = UnityBuildDiagnosticsService.normalizeExitCode(input.exitCode);
    const matchedPatterns = UnityBuildDiagnosticsService.matchCrashEvidence(logText);
    const buildMethodInvoked = UnityBuildDiagnosticsService.detectBuildMethodInvoked(
      logText,
      input.buildMethodPattern,
    );
    const lfsPointerDllFound = input.projectPath
      ? UnityBuildDiagnosticsService.scanForLfsPointerDlls(input.projectPath).length > 0
      : false;
    const runtimeSeconds = input.runtimeSeconds ?? 0;
    const licensingFailure =
      /Access token is unavailable|Failed to update license|No valid license|license\.ulicx file not found/i.test(
        logText,
      );
    const guidErrors =
      /error CS0246:.*Library[\\/]+PackageCache|Library[\\/]+PackageCache.*error CS0246/i.test(
        logText,
      );

    const diagnostics: UnityRunDiagnostics = {
      exitCode: normalizedExitCode,
      runtimeSeconds,
      buildMethodInvoked,
      crashEvidenceFound: matchedPatterns.length > 0,
      lfsPointerDllFound,
      licensingFailure,
      guidErrors,
      packageCacheCorrupt: /Could not restore immutable package asset/i.test(logText),
      apiUpdaterRan: /APIUpdater|AssemblyUpdater|Running API updater/i.test(logText),
      importCompleted: UnityBuildDiagnosticsService.detectImportCompleted(
        input.projectPath,
        input.artifactDbMtimeBeforeMs,
        logText,
      ),
      silentSuccess: normalizedExitCode === 0 && !buildMethodInvoked,
      preserveLibrary: true,
      nukeLibrary: false,
      recommendedAction: 'fail',
      failureCategory: 'GENERIC',
      failureSummary: {
        category: 'GENERIC',
        exitCode: normalizedExitCode,
        runtimeSeconds,
        detectedSignals: [],
        compileErrorCount: 0,
        topCompileErrors: [],
        remediationHint: '',
      },
      matchedPatterns,
    };

    const action = UnityBuildDiagnosticsService.recommendRecoveryAction(diagnostics);
    diagnostics.recommendedAction = action;
    diagnostics.nukeLibrary = action === 'nuke-library';
    diagnostics.preserveLibrary = !diagnostics.nukeLibrary;

    const category = UnityBuildDiagnosticsService.categorizeFailure(diagnostics, logText);
    diagnostics.failureCategory = category;
    diagnostics.failureSummary = UnityBuildDiagnosticsService.buildFailureSummary(
      diagnostics,
      logText,
      category,
    );

    return diagnostics;
  }

  static normalizeExitCode(exitCode: number): number {
    if (exitCode === 4294967295) return -1;
    if (exitCode === 3221225477) return -1073741819;

    return exitCode;
  }

  static matchCrashEvidence(logText: string): string[] {
    const matches: string[] = [];

    for (const pattern of UnityBuildDiagnosticsService.CRASH_EVIDENCE_PATTERNS) {
      if (pattern.test(logText)) {
        matches.push(pattern.source);
      }
    }

    return matches;
  }

  static recommendRecoveryAction(diagnostics: UnityRunDiagnostics): UnityRecoveryAction {
    if (diagnostics.lfsPointerDllFound) return 'retry-lfs-pull';

    if (
      diagnostics.exitCode === -1 &&
      diagnostics.runtimeSeconds > 0 &&
      diagnostics.runtimeSeconds < 60 &&
      diagnostics.licensingFailure
    ) {
      return 'retry-licensing';
    }

    if (diagnostics.silentSuccess) return 'reset-source-asset-db';
    if (diagnostics.apiUpdaterRan) return 'retry-api-updater';
    if (diagnostics.packageCacheCorrupt || diagnostics.guidErrors) return 'retry-package-cache';

    if (
      diagnostics.exitCode !== 0 &&
      diagnostics.crashEvidenceFound &&
      !diagnostics.importCompleted
    ) {
      return 'retry-two-phase-import';
    }

    if (
      diagnostics.exitCode !== 0 &&
      diagnostics.crashEvidenceFound &&
      diagnostics.importCompleted
    ) {
      return 'nuke-library';
    }

    if (diagnostics.exitCode === 0) return 'success';

    return 'fail';
  }

  static scanForLfsPointerDlls(projectPath: string, maxBytes = 200): string[] {
    const matches: string[] = [];
    const roots = ['Assets', 'Packages']
      .map((root) => path.join(projectPath, root))
      .filter((root) => fs.existsSync(root));

    const scan = (directory: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
          continue;
        }

        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.dll')) {
          continue;
        }

        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > maxBytes) continue;

          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.startsWith(UnityBuildDiagnosticsService.LFS_POINTER_HEADER)) {
            matches.push(fullPath);
          }
        } catch {
          // Binary or inaccessible files are not LFS pointer stubs.
        }
      }
    };

    for (const root of roots) {
      scan(root);
    }

    return matches;
  }

  static categorizeFailure(
    diagnostics: UnityRunDiagnostics,
    logText: string,
  ): UnityFailureCategory {
    if (diagnostics.exitCode === 0 && diagnostics.buildMethodInvoked) return 'SUCCESS';

    if (diagnostics.licensingFailure) return 'LICENSE';

    if (
      diagnostics.crashEvidenceFound ||
      diagnostics.exitCode === -1073741819 // 0xC0000005 access violation
    ) {
      return 'CRASH';
    }

    if (diagnostics.guidErrors) return 'PACKAGE';

    const compileErrors = logText.match(/error CS\d{4}:/g);
    if (compileErrors && compileErrors.length > 0) return 'COMPILE';

    if (
      diagnostics.exitCode === 0 &&
      !diagnostics.buildMethodInvoked &&
      !diagnostics.crashEvidenceFound
    ) {
      return 'SKIP';
    }

    if (
      diagnostics.exitCode === -1 &&
      !diagnostics.crashEvidenceFound &&
      !diagnostics.licensingFailure
    ) {
      return 'EXIT_NEG1';
    }

    return 'GENERIC';
  }

  static buildFailureSummary(
    diagnostics: UnityRunDiagnostics,
    logText: string,
    category: UnityFailureCategory,
  ): UnityFailureSummary {
    const compileErrors = logText.match(/error CS\d{4}:.*/g) || [];
    const uniqueErrors = [...new Set(compileErrors)];

    const signals: string[] = [];
    if (diagnostics.licensingFailure) signals.push('licensing-failure');
    if (diagnostics.crashEvidenceFound) signals.push('crash-evidence');
    if (diagnostics.lfsPointerDllFound) signals.push('lfs-pointer-dlls');
    if (diagnostics.guidErrors) signals.push('package-guid-errors');
    if (diagnostics.packageCacheCorrupt) signals.push('package-cache-corrupt');
    if (diagnostics.apiUpdaterRan) signals.push('api-updater-ran');
    if (diagnostics.silentSuccess) signals.push('silent-exit-0');
    for (const pattern of diagnostics.matchedPatterns) {
      signals.push(`crash:${pattern}`);
    }

    const remediationHints: Record<UnityFailureCategory, string> = {
      LICENSE: 'Retry with delay -- licensing IPC contention or expired seat.',
      CRASH: 'Clear ScriptAssemblies or nuke Library. Check for ILPP/native plugin crashes.',
      COMPILE: 'Fix compile errors. If GUID-based, clear PackageCache and ScriptAssemblies.',
      PACKAGE: 'Clear PackageCache and ScriptAssemblies, then retry.',
      SKIP: 'Build method was never invoked. Check -executeMethod argument and build profile.',
      EXIT_NEG1: 'Exit -1 with no clear signal. Check Unity Editor.log for more context.',
      GENERIC: 'No specific failure pattern matched. Check Unity Editor.log manually.',
      SUCCESS: 'Build succeeded.',
    };

    return {
      category,
      exitCode: diagnostics.exitCode,
      runtimeSeconds: diagnostics.runtimeSeconds,
      detectedSignals: signals,
      compileErrorCount: compileErrors.length,
      topCompileErrors: uniqueErrors.slice(0, 10),
      remediationHint: remediationHints[category],
    };
  }

  static emitSummary(diagnostics: UnityRunDiagnostics): void {
    const summary = diagnostics.failureSummary;

    const lines = [
      `## Unity Build Diagnostics`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| Category | \`${summary.category}\` |`,
      `| Exit Code | \`${summary.exitCode}\` |`,
      `| Runtime | ${summary.runtimeSeconds}s |`,
      `| Signals | ${summary.detectedSignals.join(', ') || 'none'} |`,
      `| Compile Errors | ${summary.compileErrorCount} |`,
      `| Recommended Action | \`${diagnostics.recommendedAction}\` |`,
      `| Remediation | ${summary.remediationHint} |`,
    ];

    if (summary.topCompileErrors.length > 0) {
      lines.push('', '### Top Compile Errors', '```');
      for (const error of summary.topCompileErrors) {
        lines.push(error);
      }
      lines.push('```');
    }

    const markdown = lines.join('\n');

    // Console output
    core.info(`[BuildDiagnostics] Category: ${summary.category}`);
    core.info(
      `[BuildDiagnostics] Exit code: ${summary.exitCode}, Runtime: ${summary.runtimeSeconds}s`,
    );
    core.info(`[BuildDiagnostics] Signals: ${summary.detectedSignals.join(', ') || 'none'}`);
    if (summary.compileErrorCount > 0) {
      core.info(`[BuildDiagnostics] Compile errors: ${summary.compileErrorCount}`);
    }
    core.info(`[BuildDiagnostics] Action: ${diagnostics.recommendedAction}`);
    core.info(`[BuildDiagnostics] Hint: ${summary.remediationHint}`);

    // GitHub Step Summary
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      try {
        fs.appendFileSync(summaryFile, markdown + '\n');
      } catch {
        core.warning('[BuildDiagnostics] Failed to write GitHub Step Summary');
      }
    }
  }

  private static detectBuildMethodInvoked(logText: string, buildMethodPattern?: RegExp): boolean {
    if (buildMethodPattern) {
      return buildMethodPattern.test(logText);
    }

    return /BuildMethodInvoked\s*[:=]\s*True|Executing method|executeMethod/i.test(logText);
  }

  private static detectImportCompleted(
    projectPath?: string,
    artifactDbMtimeBeforeMs?: number,
    logText?: string,
  ): boolean {
    if (
      /AssetDatabase.*Refresh.*completed|InitialRefresh.*completed|Refresh completed/i.test(
        logText || '',
      )
    ) {
      return true;
    }

    if (!projectPath) {
      return false;
    }

    const artifactDb = path.join(projectPath, 'Library', 'ArtifactDB');
    try {
      if (!fs.existsSync(artifactDb)) {
        return false;
      }

      if (artifactDbMtimeBeforeMs === undefined) {
        return fs.statSync(artifactDb).size > 0;
      }

      return fs.statSync(artifactDb).mtimeMs > artifactDbMtimeBeforeMs;
    } catch {
      return false;
    }
  }
}
