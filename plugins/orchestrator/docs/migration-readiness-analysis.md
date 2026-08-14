# Migration Readiness Analysis: GameClient CI → game-ci Orchestrator

## Overview

This document analyses what GameClient CI functionality the orchestrator already covers, what GameClient could retire once migrated, and what enhancements the orchestrator needs to fully support GameClient's reliability requirements. It is a companion to `gameclient-comparison-report.md`, which provides the detailed technical comparison. This document focuses on migration posture and actionable next steps.

---

## Migration Readiness Matrix

| GameClient Capability       | Orchestrator Coverage                | Action   | Notes                                                                        |
| --------------------------- | ------------------------------------ | -------- | ---------------------------------------------------------------------------- |
| Git integrity check (fsck)  | Full — BuildReliabilityService       | RETIRE   |                                                                              |
| Stale lock cleanup          | Full — BuildReliabilityService       | RETIRE   |                                                                              |
| Submodule validation        | Full — BuildReliabilityService       | RETIRE   |                                                                              |
| Reserved filename cleanup   | Full — BuildReliabilityService       | RETIRE   |                                                                              |
| Build archival              | Full — BuildReliabilityService       | RETIRE   |                                                                              |
| Git env config              | Full — BuildReliabilityService       | RETIRE   |                                                                              |
| LFS transfer agent config   | Full — LfsAgentService               | RETIRE   |                                                                              |
| Submodule profile switching | Full — SubmoduleProfileService       | RETIRE   |                                                                              |
| Child workspace isolation   | Full — ChildWorkspaceService         | RETIRE   |                                                                              |
| Test suite YAML parsing     | Full — TestWorkflowService           | RETIRE   |                                                                              |
| Local Library cache         | Partial — LocalCacheService uses tar | SIMPLIFY | GameClient uses Move-Item (O(1) rename), superior for 50 GB+ Library folders |
| Unity failure detection     | None                                 | KEEP     | 12+ crash patterns, orchestrator has zero                                    |
| Recovery chain              | None                                 | KEEP     | 11-stage multi-handler chain                                                 |
| Zombie process cleanup      | None                                 | KEEP     | Workspace-scoped Win32 CIM                                                   |
| LFS DLL hydration gate      | None                                 | KEEP     | Pre-launch pointer scan                                                      |
| Hub health check            | None                                 | KEEP     | Process-based, no CLI                                                        |
| BATCH_MODE injection        | None                                 | KEEP     | csc.rsp manipulation                                                         |
| Shell ILPP mitigation       | None                                 | KEEP     | Profile-specific Burst disable + Bee clearing                                |
| PID tracking + watchdog     | None                                 | KEEP     | Cancellation and cleanup on timeout                                          |
| Asset timestamp race fix    | None                                 | KEEP     | Pre-flight deletion of InitializeOnLoad assets                               |
| Accelerator management      | None                                 | KEEP     | UUM-4003 workaround for cold imports                                         |
| Live log path               | None                                 | KEEP     | Host-side tailing via stable log path                                        |
| Crash-evidence gating       | None                                 | KEEP     | 12-pattern Library nuke gate                                                 |
| Editor.log preservation     | None                                 | KEEP     | Post-mortem diagnosis before next launch overwrites it                       |

**Summary:** 10 capabilities can retire immediately, 1 can simplify, 13 must be retained or added to the orchestrator before migration is complete.

---

## Implementable PR Shape for Orchestrator

The practical orchestrator-side work breaks into three PRs. Each is independently mergeable and delivers value to all game-ci users, not just GameClient.

### PR 1: Reusable Unity Diagnostics and Recovery Primitives

**New service: `UnityProcessMonitorService`**

Real-time stdout/stderr pattern matching during Unity execution. The service scans Unity output as it streams and accumulates diagnostic flags:

```typescript
interface UnityRunDiagnostics {
  exitCode: number;
  runtimeSeconds: number;
  buildMethodInvoked: boolean;
  nativeCrash: boolean;
  lfsPointerDllFound: boolean;
  licensingFailure: boolean;
  guidErrors: boolean;
  packageCacheCorrupt: boolean;
  importCompleted: boolean; // ArtifactDB timestamp advanced
  oom: boolean;
  accessTokenUnavailable: boolean;
}
```

Configurable pattern registry — the 12 canonical crash patterns from GameClient experience are the default set:

```
ErrorInvalidPPtrCast, Segmentation fault, SIGSEGV, AccessViolationException,
Fatal error in Unity CIL, Crash!!!, Fatal Error!, A crash has been intercepted,
EditorUtility.*:.*NullRef, AssetDatabase.*corruption, Native Crash Reporting,
Build asset version error
```

Exported for unity-builder and provider plugins to call directly.

**New service: `UnityRecoveryService`**

Configurable recovery stages — enable or disable per stage at the call site. Default stages in execution order:

1. Licensing race retry — 30-second delay, up to 2 retries, no Library change
2. Import stall retry — preserve Library, retry from warm state
3. Crash-evidence Library nuke — only when crash evidence confirmed in logs
4. ScriptAssemblies-only clear — for compile-error-only failures
5. PackageCache clear + retry — for GUID errors and UPM immutable asset corruption
6. Two-phase import — import-only pass then build pass, fallback to Library nuke if Phase 1 crashes

Each stage manages its own retry budget. Licensing retries do not consume the crash retry budget. A two-phase import attempt does not prevent a subsequent licensing retry.

Hook interface: `onFailureDetected(pattern, diagnostics) → RecoveryAction`

---

### PR 2: Safer Cache Validation and Fallback Behaviour

**Enhancements to `LocalCacheService`:**

- **Library skeleton detection** — verify `Library/ArtifactDB` is non-zero and `Library/ScriptAssemblies/` exists before treating a restore as a warm hit. A skeleton Library is a cache miss.
- **Crash-evidence-gated cache save** — do not save Library to shared cache when crash evidence was found in the run. A corrupt Library in the shared cache poisons all subsequent restores.
- **Move-based restore option for Windows** — `fs.renameSync` instead of tar extract when source and destination are on the same volume. O(1) NTFS rename versus multi-minute tar extract for a 50 GB Library.
- **Cache completeness validation before accepting a restore** — verify the directory has meaningful content, not just that it exists and is non-empty.
- **Selective clearing primitives** — functions to clear `ScriptAssemblies/`, `Library/Bee/`, and `Library/PackageCache/` independently. Full Library nuke is rarely the right choice.

---

### PR 3: Host-Runner Process Cleanup Primitives

**New service: `ProcessCleanupService`**

_Pre-launch cleanup:_

- Workspace-scoped `Unity.exe` kill — match by `-projectPath` in `CommandLine` so other runners' Unity instances are not affected
- Orphan satellite kill — `UnityShaderCompiler`, `ILPP.Runner`, `PackageManager`, `CrashHandler`, `AutoQuitter` where parent Unity process is dead

_Post-exit cleanup:_

- Child process cleanup — `bee_backend`, `ILPP`, `ShaderCompiler` with inherited pipe handles that outlive Unity
- Hub health check — process existence without CLI invocation (any `Hub.exe` invocation in headless mode causes instability)
- PID tracking and cancellation watchdog

Windows-specific implementation. Exported for use by providers and the CLI provider.

---

## Priority and Effort Estimates

| PR                             | Impact                                         | Effort    | Notes                                                                                                              |
| ------------------------------ | ---------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| PR 1: Diagnostics and Recovery | High — benefits all game-ci users              | 4–6 weeks | Every Unity CI project eventually hits crashes. The orchestrator currently has zero detection.                     |
| PR 2: Cache Validation         | Medium — most valuable for large projects      | 2–3 weeks | Prevents corrupt cache propagation. Move-based restore is a significant speed improvement for self-hosted runners. |
| PR 3: Process Cleanup          | Medium — most valuable for self-hosted runners | 1–2 weeks | Prevents zombie contention and OOM from accumulated stale processes between runs.                                  |

PRs can proceed in parallel. PR 1 has no dependency on PR 2 or PR 3.

---

## Known Unity Version Issues to Document

These failure modes are confirmed in production CI. They should be referenced in orchestrator documentation and optionally detected by the diagnostics service pattern registry in PR 1.

| Issue                                                 | Unity Version | Key Log Signal                                          | Mitigation                                                 |
| ----------------------------------------------------- | ------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| GUID ordering bug on cold import                      | 6000.x        | CS0246 in `Library/PackageCache/` paths                 | Clear PackageCache, retry                                  |
| Personal license — Named User only, no CLI activation | 6000.x        | `No valid license` within 30s                           | Hub sign-in or Pro license                                 |
| ILPP Runner CLR crash                                 | 6000.4.5f1    | `0xe0434352` from `Unity.ILPP.Runner.exe`               | `BURST_DISABLE_COMPILATION=1`, clear `Library/Bee/`        |
| UPM immutable package corruption on profile switch    | All           | `Could not restore immutable package asset`             | Clear PackageCache and global UPM cache                    |
| InitializeOnLoad timestamp race                       | All           | Exit 0, build method never invoked                      | Delete offending asset and SourceAssetDB before launch     |
| YAML OOM on large assets                              | All           | Exit `-1` during InitialRefresh, ArtifactDB not updated | Reduce SerializeReference data, reduce import worker count |
| Win32 menu handle exhaustion in batchmode             | All           | `Not enough memory resources` during domain reload      | Audit `[MenuItem]` registrations, increase desktop heap    |

Full detail on each issue: `gameclient-comparison-report.md` section 10.

---

## Migration Gate Criteria

Migration from GameClient's self-managed pipeline to the orchestrator is not recommended until:

1. PR 1 (Diagnostics and Recovery) is merged and validated on at least one large Unity project
2. PR 2 (Cache Validation) is merged — the skeleton detection and selective clearing primitives are required for a project with 50 GB+ Library folders
3. PR 3 (Process Cleanup) is merged — persistent self-hosted runners with concurrent workspaces require workspace-scoped process management
4. The orchestrator supports Move-based Library restore on Windows (included in PR 2)
5. The known Unity version issues table above is reflected in orchestrator documentation and optionally in the pattern registry

Items 1–3 are blocking. Items 4–5 are strongly recommended before migration begins.
