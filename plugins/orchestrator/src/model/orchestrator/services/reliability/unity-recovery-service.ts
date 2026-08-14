import {
  UnityBuildDiagnosticsService,
  UnityRecoveryAction,
  UnityRunDiagnostics,
} from './unity-build-diagnostics-service';

export interface UnityRecoveryBudget {
  max: number;
  used: number;
}

export interface UnityRecoveryBudgets {
  licensingRace: UnityRecoveryBudget;
  lfsPointer: UnityRecoveryBudget;
  packageCache: UnityRecoveryBudget;
  apiUpdater: UnityRecoveryBudget;
  twoPhaseImport: UnityRecoveryBudget;
  libraryNuke: UnityRecoveryBudget;
  sourceAssetDbReset: UnityRecoveryBudget;
}

export interface UnityRecoveryDecision {
  action: UnityRecoveryAction;
  shouldRetry: boolean;
  preserveLibrary: boolean;
  nukeLibrary: boolean;
  clearSubfolders: string[];
  delaySeconds: number;
  reason: string;
  budgets: UnityRecoveryBudgets;
}

export class UnityRecoveryService {
  static createDefaultBudgets(): UnityRecoveryBudgets {
    return {
      licensingRace: { max: 2, used: 0 },
      lfsPointer: { max: 1, used: 0 },
      packageCache: { max: 1, used: 0 },
      apiUpdater: { max: 1, used: 0 },
      twoPhaseImport: { max: 1, used: 0 },
      libraryNuke: { max: 1, used: 0 },
      sourceAssetDbReset: { max: 1, used: 0 },
    };
  }

  static decide(
    diagnostics: UnityRunDiagnostics,
    budgets: UnityRecoveryBudgets = UnityRecoveryService.createDefaultBudgets(),
  ): UnityRecoveryDecision {
    const action = UnityBuildDiagnosticsService.recommendRecoveryAction(diagnostics);

    switch (action) {
      case 'retry-lfs-pull':
        return UnityRecoveryService.consumeBudget(action, budgets.lfsPointer, budgets, {
          clearSubfolders: [],
          delaySeconds: 0,
          reason: 'LFS pointer DLLs are present; hydrate LFS objects before retrying Unity.',
        });
      case 'retry-licensing':
        return UnityRecoveryService.consumeBudget(action, budgets.licensingRace, budgets, {
          clearSubfolders: [],
          delaySeconds: 30,
          reason: 'Unity licensing startup race detected; retry without modifying Library.',
        });
      case 'retry-package-cache':
        return UnityRecoveryService.consumeBudget(action, budgets.packageCache, budgets, {
          clearSubfolders: ['PackageCache'],
          delaySeconds: 0,
          reason: 'PackageCache GUID or immutable asset corruption detected.',
        });
      case 'retry-api-updater':
        return UnityRecoveryService.consumeBudget(action, budgets.apiUpdater, budgets, {
          clearSubfolders: [],
          delaySeconds: 0,
          reason: 'Unity API updater ran; retry against the updated Library.',
        });
      case 'retry-two-phase-import':
        return UnityRecoveryService.consumeBudget(action, budgets.twoPhaseImport, budgets, {
          clearSubfolders: [],
          delaySeconds: 0,
          reason: 'Crash occurred before import completed; retry with import-only then build.',
        });
      case 'reset-source-asset-db':
        return UnityRecoveryService.consumeBudget(action, budgets.sourceAssetDbReset, budgets, {
          clearSubfolders: ['SourceAssetDB'],
          delaySeconds: 0,
          reason:
            'Unity exited 0 without invoking the build method; reset timestamp-sensitive metadata.',
        });
      case 'nuke-library':
        return UnityRecoveryService.consumeBudget(action, budgets.libraryNuke, budgets, {
          clearSubfolders: ['Library'],
          delaySeconds: 0,
          reason: 'Crash evidence was found after import completed; Library corruption is likely.',
          nukeLibrary: true,
        });
      case 'success':
        return UnityRecoveryService.buildDecision(action, budgets, {
          shouldRetry: false,
          preserveLibrary: true,
          nukeLibrary: false,
          clearSubfolders: [],
          delaySeconds: 0,
          reason: 'Unity run succeeded.',
        });
      default:
        return UnityRecoveryService.buildDecision(action, budgets, {
          shouldRetry: false,
          preserveLibrary: true,
          nukeLibrary: false,
          clearSubfolders: [],
          delaySeconds: 0,
          reason: 'No targeted Unity recovery stage matched.',
        });
    }
  }

  private static consumeBudget(
    action: UnityRecoveryAction,
    budget: UnityRecoveryBudget,
    budgets: UnityRecoveryBudgets,
    options: {
      clearSubfolders: string[];
      delaySeconds: number;
      reason: string;
      nukeLibrary?: boolean;
    },
  ): UnityRecoveryDecision {
    if (budget.used >= budget.max) {
      return UnityRecoveryService.buildDecision('fail', budgets, {
        shouldRetry: false,
        preserveLibrary: true,
        nukeLibrary: false,
        clearSubfolders: [],
        delaySeconds: 0,
        reason: `Recovery budget exhausted for ${action}.`,
      });
    }

    budget.used++;

    return UnityRecoveryService.buildDecision(action, budgets, {
      shouldRetry: true,
      preserveLibrary: options.nukeLibrary !== true,
      nukeLibrary: options.nukeLibrary === true,
      clearSubfolders: options.clearSubfolders,
      delaySeconds: options.delaySeconds,
      reason: options.reason,
    });
  }

  private static buildDecision(
    action: UnityRecoveryAction,
    budgets: UnityRecoveryBudgets,
    options: {
      shouldRetry: boolean;
      preserveLibrary: boolean;
      nukeLibrary: boolean;
      clearSubfolders: string[];
      delaySeconds: number;
      reason: string;
    },
  ): UnityRecoveryDecision {
    return {
      action,
      shouldRetry: options.shouldRetry,
      preserveLibrary: options.preserveLibrary,
      nukeLibrary: options.nukeLibrary,
      clearSubfolders: options.clearSubfolders,
      delaySeconds: options.delaySeconds,
      reason: options.reason,
      budgets,
    };
  }
}
