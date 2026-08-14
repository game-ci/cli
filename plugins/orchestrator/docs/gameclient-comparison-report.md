# GameClient CI vs game-ci: Caching & Reliability Comparison

This report compares the CI reliability systems in `game-ci/orchestrator` + `game-ci/unity-builder` against the hardened pipeline in `frostebite/GameClient`. The goal is to identify concrete improvements game-ci could adopt.

---

## 1. Library Caching Comparison

### game-ci Current State

**unity-builder** has minimal caching logic. `src/model/cache.ts` is 26 lines — it checks whether `Library/` exists and emits a warning suggesting users set up `actions/cache` externally. There is no built-in cache save/restore.

**orchestrator** has three caching layers:

- **LocalCacheService** (`services/cache/local-cache-service.ts`): Filesystem-based tar archives keyed by `{platform}-{unityVersion}-{branch}`. Restores the latest `.tar` file by mtime, saves with timestamp-based names, keeps latest 2 entries, garbage collects entries older than 7 days.
- **Remote caching** (`remote-client/caching.ts`): S3/rclone-based tar push/pull with disk space checks, tar integrity validation before extraction, timeout protection (600s), and aggressive cleanup when disk usage exceeds 90%.
- **ChildWorkspaceService** (`services/cache/child-workspace-service.ts`): Atomic `fs.renameSync` (O(1) on NTFS) for workspace isolation per product/build-target. Separates Library cache from workspace cache. Stale workspace cleanup with retention policy.
- **CacheCheckpointService** (`services/cache/cache-checkpoint-service.ts`): Shell trap that saves partial Library on build failure (OOM, timeout, crash) so the next build starts from the partial state rather than zero.

### GameClient's Approach

GameClient's caching is significantly more sophisticated in several areas:

**8-stage (documented as 6-stage) Library fallback discovery** (`PreUnityJob.ps1` / `ci-shell-build-reliability.md`):

1. Own cache — exact match (same profile, same framework state)
2. Same framework, other profiles (e.g., Shell-Server vs Shell-Client)
3. Shell engine bridge (generic Shell Library as shared seed)
4. Active development from other frameworks (ToW, AoO profiles)
5. Inactive releasable profiles
6. Any remaining Library in the cache hierarchy

When using a fallback cache from a different profile, GameClient selectively clears `ScriptAssemblies` and `Bee/` (profile-dependent compilation artifacts) while preserving asset imports (textures, meshes, shader cache — profile-independent).

**Move-vs-Copy strategy**: Library restore uses `Move-Item` (instant same-volume rename on NTFS). Only the shared seed copy to `D:\CI\Cache\` uses `Copy-Item`, and that runs off the critical path in `PostUnityJob`.

**AssetDatabase skeleton detection**: Validates the restored Library is not a skeleton (zero-byte `ArtifactDB` or `assetDatabase.info`) before treating it as a warm hit. A skeleton is treated as a cache MISS.

**Profile state fingerprinting**: Cache keys incorporate the active submodule profile fingerprint, so profile switches automatically invalidate stale caches.

### What game-ci Could Adopt

| Improvement                                                                                                                                                                                                    | Priority | Effort |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **Skeleton detection before accepting cache hit** — check that `Library/ArtifactDB` exists and is non-zero before treating cache as restored                                                                   | High     | Low    |
| **Selective cache cleaning on profile/config change** — clear `ScriptAssemblies` and `Bee/` from fallback caches while preserving asset imports                                                                | High     | Medium |
| **Multi-tier fallback discovery** — when exact cache key misses, try progressively broader keys (same engine version, different branch; same platform, different version)                                      | Medium   | Medium |
| **Move-based restore for local caching** — `fs.renameSync` instead of tar extract when source and destination are on the same volume (ChildWorkspaceService already does this, but LocalCacheService uses tar) | Medium   | Low    |
| **Cache completeness validation on save** — verify Library has meaningful content before saving (not just "directory exists and is non-empty")                                                                 | Medium   | Low    |

---

## 2. Crash Recovery Comparison

### game-ci Current State

**unity-builder** has **no crash recovery**. The build scripts (`build.sh`, `build.ps1`) run Unity once, capture the exit code, and report success/failure. There is no retry, no crash detection, no recovery logic.

**orchestrator** has:

- `BuildReliabilityService.recoverCorruptedRepo()`: Git-level recovery (clean stale locks, re-fetch, retry fsck). This is repository recovery, not Unity crash recovery.
- `CacheCheckpointService`: Saves partial Library on failure via shell trap. This is cache preservation, not build retry.
- No Unity-specific crash detection or build retry logic.

### GameClient's Approach

GameClient has a **multi-handler recovery chain** in `Invoke-UnityBuild.ps1` with 12 canonical crash-evidence patterns:

```
ErrorInvalidPPtrCast, Segmentation fault, SIGSEGV, AccessViolationException,
Fatal error in Unity CIL, Crash!!!, Fatal Error!, A crash has been intercepted,
EditorUtility.*:.*NullRef, AssetDatabase.*corruption, Native Crash Reporting,
Build asset version error
```

**Recovery handlers (executed in order on failure):**

1. **LFS pointer DLL detection**: Scans for DLLs that are still LFS pointer stubs (< 200 bytes + LFS signature). If found, runs `git lfs pull` with timeout, then retries.

2. **Licensing race detection**: When Unity exits -1 within ~60 seconds with "Access token is unavailable" in logs, identifies it as a licensing IPC mutex race (concurrent Unity instances) and retries after a delay rather than nuking Library.

3. **API Updater retry**: When Unity's API Updater ran during the build, retries without `-disable-assembly-updater` to let GUID references in package assemblies get fixed.

4. **Package GUID compilation error retry**: Detects `error CS0246` in `Library/PackageCache/` paths, clears `PackageCache/` and retries.

5. **UPM immutable package asset corruption**: Detects "Could not restore immutable package asset" (PackageCache index mapped to wrong packages after profile switch), clears PackageCache and retries.

6. **Two-phase import retry**: When exit -1 occurs before import completes (ArtifactDB timestamp didn't advance):
   - Phase 1: Import-only pass (no `-executeMethod`) to build a warm Library
   - Phase 2: Build pass against the warm Library
   - Falls back to full Library nuke if Phase 1 fails

7. **Silent build method skip (exit 0, BuildMethodInvoked False)**: Detects when Unity exits "successfully" without ever invoking the build method (caused by `[InitializeOnLoad]` asset timestamp races). Deletes the offending auto-generated assets + SourceAssetDB between phases.

8. **Crash-evidence-gated Library nuke**: Only nukes Library when crash evidence is found in logs. A partial Library from a failed import is better than no Library.

### What game-ci Could Adopt

| Improvement                                                                                                                                                   | Priority | Effort |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **Exit code + log content recovery routing** — don't treat all failures the same; route to specific handlers based on log patterns                            | Critical | High   |
| **Crash-evidence gating for Library deletion** — only nuke Library when crash evidence is found, not on any non-zero exit                                     | Critical | Medium |
| **Two-phase import retry** — when first attempt fails during import, do an import-only pass then a build pass                                                 | High     | Medium |
| **Silent exit-0 detection** — detect when Unity exits 0 without invoking the build method, override to failure                                                | High     | Low    |
| **LFS pointer DLL detection** — scan for unhydrated DLLs before Unity launch, not just after failure                                                          | High     | Medium |
| **Licensing race detection** — identify licensing IPC mutex races (short runtime + exit -1 + "Access token unavailable") and retry with delay instead of nuke | Medium   | Low    |

---

## 3. Library Nuke vs Preservation

### game-ci Current State

game-ci has **no Library nuke/preserve intelligence**. If a build fails, the Library is either:

- Left in whatever state it ended up in (unity-builder)
- Saved as-is via CacheCheckpointService trap if enabled (orchestrator)
- Or the user sets up `actions/cache` externally, which blindly saves/restores

There is no decision logic about when to nuke vs preserve.

### GameClient's Approach

GameClient has a clear decision framework:

**Preserve Library when:**

- Exit -1 without crash evidence in logs (partial import is still progress)
- Licensing race (transient, Library is fine)
- API Updater ran (Library needs the updated GUIDs, not a nuke)
- Package GUID errors (clear PackageCache only, not the whole Library)
- Short runtime failures (< 60s, likely startup issue not Library corruption)

**Nuke Library when:**

- Crash evidence found in logs (12 canonical patterns)
- Two-phase import Phase 1 also crashes
- Import stall retry fails with exit -1 (escalation)
- Explicit Library corruption indicators (`AssetDatabase.*corruption`, `ErrorInvalidPPtrCast`)

**Selective clearing (not full nuke):**

- `ScriptAssemblies/` — cleared on profile switch or compilation errors
- `Library/Bee/` — cleared for Shell profile builds (stale ILPP artifacts from other profiles)
- `Library/PackageCache/` — cleared on GUID errors or immutable asset corruption
- `SourceAssetDB` — cleared between two-phase recovery phases (timestamp race fix)
- Auto-generated assets (e.g., `SelectionHistory.asset`) — deleted before Unity launch to prevent InitializeOnLoad timestamp races

### What game-ci Could Adopt

| Improvement                                                                                                                                              | Priority | Effort |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **Preserve-by-default, nuke-on-evidence policy** — stop treating Library as disposable; a partial Library saves hours of reimport time on large projects | Critical | Medium |
| **Selective clearing primitives** — add functions to clear ScriptAssemblies, Bee, PackageCache independently rather than all-or-nothing                  | High     | Low    |
| **Log-based nuke decision** — parse Unity log output for the 12 crash-evidence patterns before deciding to nuke                                          | High     | Medium |
| **SourceAssetDB-only reset** — for timestamp races, deleting just SourceAssetDB + Temp forces a metadata rebuild without full reimport                   | Medium   | Low    |

---

## 4. Process Management

### game-ci Current State

**unity-builder** on Windows: Launches Unity via `Start-Process`, polls `HasExited` every 3 seconds. No timeout handling, no zombie cleanup, no orphan detection.

**unity-builder** on Linux: Launches `unity-editor` directly in bash. Captures exit code. No timeout, no zombie cleanup.

**orchestrator**: Has resource tracking (`resource-tracking.ts`) and hot-runner health monitoring but no Unity-specific process management.

### GameClient's Approach

**Pre-launch zombie cleanup** (`Invoke-UnityBuild.ps1`):

- Scans for stale `Unity.exe` processes whose `-projectPath` matches the current workspace
- Kills orphaned satellite processes (`UnityShaderCompiler`, `UnityPackageManager`, `Unity.ILPP.Runner`, `Unity.ILPP.Trigger`, `UnityCrashHandler64`, `UnityAutoQuitter`) whose parent Unity process no longer exists
- Scoped by workspace path to avoid killing legitimate processes from other runners

**Unity Hub health check**: Verifies Hub and `Unity.Licensing.Client` are running before launch (without invoking Hub CLI, which can destabilize it in headless mode).

**ILPP orphan cleanup**: Before each Unity launch, kills `Unity.ILPP.Trigger` and `Unity.ILPP.Runner` processes whose parent is dead. Orphaned ILPP holds file locks that block the new Unity process.

**Git process cleanup** (`Stop-GitProcessesInWorkspace`): Kills lingering `git.exe`, `git-remote-https.exe`, `git-lfs.exe` processes holding file locks in the workspace (e.g., `FETCH_HEAD` locks in `Library/PackageCache/` from UPM git-based package clones).

**Directory deletion with retry** (`Remove-DirectoryWithRetry`): 4-attempt deletion strategy (Remove-Item, cmd /c rd, wait for locks, retry both) because orphaned processes are slow to release file handles.

**Async output capture with deadlock prevention**: Uses `Register-ObjectEvent` for async stdout/stderr reading instead of synchronous `ReadLine()`. Unity child processes (`bee_backend`, etc.) inherit stdout pipe handles and outlive Unity, causing synchronous reads to block forever.

**Per-process timeout**: `MaxWaitMinutes` parameter with process kill on timeout.

### What game-ci Could Adopt

| Improvement                                                                                                                                    | Priority | Effort |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **Pre-launch zombie cleanup** — kill stale Unity + satellite processes from previous runs before starting a new build                          | Critical | Medium |
| **Workspace-scoped process killing** — match processes by `-projectPath` command line to avoid killing processes from other workspaces/runners | Critical | Low    |
| **ILPP orphan detection** — kill ILPP processes whose parent Unity is dead                                                                     | High     | Low    |
| **Async output capture (Windows)** — switch from `Start-Process` polling to async event-based reading to prevent pipe deadlocks                | High     | Medium |
| **Directory deletion retry** — when deleting Library or build output, retry with delays for file lock release                                  | Medium   | Low    |
| **Unity Hub health check** — verify Hub is running before launch (process check only, no CLI probe)                                            | Medium   | Low    |

---

## 5. Additional GameClient Features Not Present in game-ci

### Accelerator (Unity Cache Server) Management

GameClient dynamically enables/disables the Unity Accelerator based on cache state:

- Warm cache HIT: Accelerator enabled
- Cold import (no Library): Accelerator disabled (UUM-4003 crash workaround)
- Any retry: Accelerator always disabled
- Shell profile first attempt: Accelerator disabled (cross-profile metadata instability)

### UPM Offline Mode

When Library cache is an exact HIT, GameClient sets `UPM_OFFLINE=1` to skip the UPM registry check (saves 30-50 seconds). Disabled on retries and non-HIT cache states.

### ILPP Crash Mitigation (Shell/Generic Profiles)

- `BURST_DISABLE_COMPILATION=1` for Shell profile builds (prevents ILPP Runner CLR crash)
- `Library/Bee/` clearing before Shell launches (removes stale ILPP artifacts from other profiles)

### InitializeOnLoad Timestamp Race Prevention

Pre-flight deletion of auto-generated assets that `[InitializeOnLoad]` constructors create, forcing recreation within the same Unity session to avoid SourceAssetDB timestamp mismatches.

---

## 6. Recommended Improvements — Prioritized

### Tier 1: High Impact, Achievable Now

1. **Crash-evidence-gated Library management** — Parse Unity log for crash patterns. Preserve Library on non-crash failures; only nuke when evidence warrants it. This single change would save the most time for large projects.

2. **Pre-launch zombie cleanup** — Kill stale Unity and satellite processes before each build. Prevents "Build asset version error" from competing Unity instances and OOM from accumulated processes.

3. **Silent exit-0 detection** — When Unity exits 0 but the build method was never invoked, treat as failure. Currently unity-builder would report this as success.

4. **Library skeleton detection** — Before accepting a cache hit, verify `Library/ArtifactDB` is non-zero. Prevents treating an empty Library shell as a warm cache.

### Tier 2: High Impact, Medium Effort

5. **Two-phase import retry** — When first attempt fails during import, run import-only pass then build pass. Prevents build method from racing with incomplete import.

6. **Multi-tier cache fallback** — When exact cache key misses, try broader keys. A Library from a different branch of the same project is far better than cold import.

7. **Selective Library clearing** — Add primitives to clear `ScriptAssemblies/`, `Bee/`, `PackageCache/` independently. These are the most common corruption targets; full Library nuke is rarely needed.

8. **Async output capture on Windows** — Replace `Start-Process` polling with async event-based reading to prevent pipe deadlocks from Unity child processes.

### Tier 3: Quality of Life

9. **Accelerator toggle based on cache state** — Disable Unity Accelerator for cold imports (UUM-4003).

10. **UPM offline mode on warm cache** — Skip registry check when Library is known-good.

11. **Licensing race detection** — Identify and retry licensing failures instead of treating them as build failures.

12. **Git process cleanup before Library operations** — Kill lingering git processes holding file locks before attempting Library deletion.

---

## Summary

The core difference is philosophy: **game-ci treats build failure as binary** (pass/fail), while **GameClient treats it as diagnostic** (what failed, why, and what's the minimum-cost recovery). GameClient's pipeline has been hardened through hundreds of CI failures on a large monorepo with profile switching, concurrent builds, and persistent workspaces. The key insight is that Library preservation (not nuke) is usually the right default — a partial Library saves hours of reimport time, and most failures don't indicate Library corruption.

The orchestrator already has good foundations (local caching, child workspaces, cache checkpoints, reliability service). The main gaps are in Unity-specific process management and intelligent failure recovery. The unity-builder's build scripts (`build.sh`, `build.ps1`, `entrypoint.ps1`) are where most of the improvements would land.

---

## 7. Host-Only vs Docker-Based Distinctions

Many of the improvements in sections 1–6 apply differently depending on whether CI runs on a persistent self-hosted runner or inside an ephemeral Docker container. This section makes those distinctions explicit.

### Host-Only (Self-Hosted Runners, Persistent Workspace)

These techniques assume a workspace that survives between runs. They are not meaningful (or are harmful) in Docker.

**Library caching:**

- Multi-tier fallback discovery across profiles — the cache hierarchy exists between runs on disk
- Runner-level cache sharing (`D:\CI\Cache\` pattern) — a shared directory on the runner host seeds multiple workspaces
- Move-based restore (`fs.renameSync` / `Move-Item`) — works because cache and workspace are on the same NTFS volume; instant same-volume rename
- Profile fingerprinting for cache invalidation — the fingerprint compares the current run's profile state against the cached Library's origin profile
- Library nuke vs preserve intelligence — worth doing because reimporting a large project costs 30–60 minutes; a preserved partial Library is valuable

**Process management:**

- Workspace-scoped zombie cleanup — other Unity instances from previous or concurrent runs may be alive on the host; scope by `-projectPath` to avoid killing legitimate processes
- NSSM service management and watchdog health checks — the runner agent is a persistent Windows service; health monitoring and automatic restart matter
- Licensing client management (`Unity.Licensing.Client`) — the Hub and licensing client are persistent processes on the host; verify they are running before launch without probing the CLI

**Cache operations:**

- Two-tier cache: Move for restore (instant), Copy for shared seed save (`D:\CI\Cache\` write) — the Copy runs off the critical path so the shared seed is available for other workspaces while the current workspace retains its Library via Move
- Library operations must always use Move, never Copy — `Library/` is multi-gigabyte; a Copy during restore or save blocks the build

### Docker-Based (Ephemeral Containers)

These characteristics apply when each build runs in a fresh container image (the standard game-ci/unity-builder model).

**Library caching:**

- Library caching must use external volume mounts or `actions/cache` — the container has no on-disk state between runs
- No runner-level cache sharing concern — containers are isolated; shared cache is handled by the cache provider (S3, GitHub cache API, etc.)
- Library nuke is "free" in the sense that the container is disposable — but preserving a cached Library in external storage and restoring it still saves hours of reimport time; nuke vs preserve intelligence still matters for cache update decisions
- Cache restore must use Copy (or tar extract), not Move — source and destination are typically on different volumes or filesystems

**Process management:**

- No zombie cleanup needed — each container starts fresh with no leftover processes
- No Hub/licensing client management via process check — licensing is handled at container build time (ULF file injection, serial activation, or Unity Build Automation credentials)
- No NSSM or service watchdog — the container lifecycle is managed by the orchestrator

### Both Environments

These techniques apply regardless of infrastructure:

| Technique                                      | Why                                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Crash evidence gating before Library decisions | The cost of reimporting incorrectly discarded Library is the same whether on host or Docker                                       |
| Silent exit-0 detection                        | Unity's "build asset version error" silent success affects both environments                                                      |
| Exit code capture and propagation              | Unity exit codes are identical across platforms                                                                                   |
| ILPP crash mitigations                         | ILPP crashes are Unity-internal; infrastructure does not change them                                                              |
| Build method invocation tracking               | The `BuildMethodInvoked` flag is derived from Unity's own log output                                                              |
| Editor.log preservation for post-mortem        | The log file path is the same; only the retrieval mechanism differs (host: direct file read; Docker: volume mount or `docker cp`) |
| Structured diagnostic flags                    | Compile errors, native crash, licensing failure, GUID errors — all appear in Unity logs regardless of environment                 |
| Two-phase import retry                         | The import-before-build split is a Unity behaviour, not an infrastructure one                                                     |
| Async output capture (Windows)                 | PowerShell pipe deadlock from Unity child processes affects any Windows host, including Windows-based Docker                      |

---

## 8. Guidelines for AI-Assisted CI Development

When working on CI infrastructure with Claude's help, the following rules reduce costly mistakes. Each CI run on a large Unity project can take 30–60 minutes and may consume runner resources shared across the team. Evidence-first diagnosis and conservative recovery decisions are the only sustainable approach.

### Evidence First, Always

**Pull the actual Unity Editor log.** CI wrapper output (PowerShell/bash script output, GitHub Actions step summary) is a summary. The real failure details are in the Unity Editor log file. On self-hosted Windows runners the log is at:

```
{workspace}/Builds/Logs/Editor.log
```

or the default Unity log path if the build does not redirect it:

```
%LOCALAPPDATA%\Unity\Editor\Editor.log
```

On Docker, it is at `/root/.config/unity3d/Editor.log` or wherever the container writes logs.

**Never diagnose from CI wrapper output alone.** The wrapper may say "Unity exited -1" — but the Unity log contains the actual crash stack trace, the specific assembly that failed, the licensing error message, or the GUID that was corrupt. Without the log, you are guessing.

### Understand the Two Log Layers

Every Unity CI run produces two separate log streams:

1. **CI script output** — the stdout/stderr of the PowerShell or bash wrapper. Contains progress messages, timing, retry decisions, and exit code reporting. This is what GitHub Actions shows in the job log.

2. **Unity Editor.log** — the Unity process's own log file. Contains domain reload events, asset import results, compile errors, ILPP output, licensing messages, crash stack traces, and the actual build method output. This is the authoritative source.

When diagnosing a failure, always read both. The CI script tells you what the runner decided to do; Unity's log tells you why Unity failed.

### Never Toggle Features to Isolate Issues

Do not disable Accelerator, ILPP, caching, or Burst to "see if it helps." Every failed CI run costs time and runner resources. Toggling features without log evidence is guessing. It also introduces the risk of leaving a feature disabled after the investigation, degrading all future builds.

The correct sequence is:

1. Pull the Unity Editor log
2. Identify the specific failure pattern (crash stack, error message, exit code + runtime duration)
3. Match to a known failure mode (see section 9)
4. Apply the targeted fix for that mode
5. Verify on the next run

### Common Unity Exit Codes

| Exit Code                       | Meaning                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `0`                             | Unity considers the session successful — but verify `BuildMethodInvoked` is `True` if a build method was expected |
| `1`                             | Unity-handled error (compile error, build failure, licensing failure, exception caught by Unity)                  |
| `-1` (or `4294967295`)          | Native crash — Unity's own crash handler ran, or the process was killed by the OS                                 |
| `-1073741819` (or `3221225477`) | Access violation (STATUS_ACCESS_VIOLATION) — native memory corruption or null dereference                         |
| `3221225495` (or `0xC0000017`)  | STATUS_NO_MEMORY — check for YAML OOM on large assets, Win32 heap exhaustion                                      |
| `3221225725` (or `0xC00000FD`)  | STATUS_STACK_OVERFLOW — deep recursion or infinite loop in native code                                            |

Exit code alone is not sufficient for routing. Always combine with log content and runtime duration.

### Iterative Hardening, Not Redesign

When CI fails, identify the specific failure mode, patch that point, and let the next failure surface. Do not redesign working systems to eliminate theoretical failure modes.

Good: "Exit -1 within 60 seconds + 'Access token is unavailable' in log = licensing race. Add a 30-second delay and retry."

Bad: "CI is unstable, let's rewrite the retry logic from scratch."

Each hardening step should be small, targeted, and verifiable in one run. The system gets more reliable through accumulated specific fixes, not architectural churn.

### Recovery Chain Design

Each failure handler should manage its own state independently. Do not use a shared flag like `$hasRetried` that prevents multiple handlers from firing in the same run. The failure modes are orthogonal — a LFS pointer DLL problem and a licensing race can appear in the same run on a cold workspace.

Pattern to follow:

```powershell
# Each handler has its own retry flag
$lfsRetried = $false
$licensingRetried = $false
$importRetried = $false

# Each handler checks only its own flag, not a global one
if ($lfsPointerFound -and -not $lfsRetried) {
    $lfsRetried = $true
    # ... handle LFS retry
}
```

### Library Is Sacred

Nuking Library costs 30–60 minutes on large projects (more on cold runners with no Accelerator). Only nuke when crash evidence in the Unity log confirms Library corruption.

Indicators that warrant a Library nuke:

- Native crash stack trace naming `AssetDatabase` or `ArtifactManager` internals
- `ErrorInvalidPPtrCast` in the Unity log (corrupt asset reference in serialized data)
- `AssetDatabase.*corruption` pattern
- Import stall: `Library/ArtifactDB` last-write timestamp did not advance after Unity ran for more than 10 minutes

Indicators that do NOT warrant a Library nuke:

- Exit -1 with short runtime (< 60 seconds) — likely licensing or startup failure, not Library corruption
- Compile errors (`CS0246`, `CS0117`) — clear `ScriptAssemblies/` only
- UPM immutable asset errors — clear `PackageCache/` only
- Licensing race (`Access token is unavailable`) — retry with delay, Library is fine
- Exit 0 without build method invoked — timestamp race, clear `SourceAssetDB` only

### PowerShell 5.1 on Windows Self-Hosted Runners

GitHub Actions `shell: powershell` targets PowerShell 5.1 (`powershell.exe`), not PowerShell 7 (`pwsh`). Do not use PowerShell 6+ features:

| Feature                                            | PS Version | Alternative                              |
| -------------------------------------------------- | ---------- | ---------------------------------------- |
| Ternary operator (`? :`)                           | PS 7+      | `if/else` block                          |
| Null coalescing (`??=`)                            | PS 7+      | `if (-not $x) { $x = $default }`         |
| Three-argument `Join-Path`                         | PS 7+      | `[System.IO.Path]::Combine()`            |
| `$ErrorActionPreference = 'Stop'` with `git` calls | Both       | `git ... 2>$null` or wrap in `try/catch` |

Test CI scripts locally with `powershell.exe`, not `pwsh`, to catch 5.1 incompatibilities before pushing.

### Git stderr on Self-Hosted Runners

Any `git` invocation can emit stderr warnings even on success: config permission warnings, LFS hint messages, detached HEAD notices. Under PowerShell 5.1 with `$ErrorActionPreference = 'Stop'`, any stderr output from an external process becomes a terminating error.

Always suppress or handle git stderr:

```powershell
# Suppress: safe when you control the call
git lfs pull 2>$null

# Or wrap: safer when you need the actual error
try { git lfs pull } catch { Write-Warning "git lfs pull failed: $_" }
```

Do not set `GIT_CONFIG_NOSYSTEM: '1'` without also setting `GIT_CONFIG_GLOBAL: ''` — the global gitconfig on self-hosted runners often has permission settings that emit warnings under the runner service account.

---

## 9. Architecture Patterns Worth Adopting

These are design-level patterns from GameClient's pipeline that translate to the orchestrator and unity-builder regardless of language (TypeScript vs PowerShell).

### Diagnostic Flag Accumulation

Track multiple failure signals during a Unity run and make recovery decisions based on the combination, not just the exit code.

```typescript
interface UnityRunDiagnostics {
  exitCode: number;
  runtimeSeconds: number;
  buildMethodInvoked: boolean;
  crashEvidenceFound: boolean;
  lfsPointerDllFound: boolean;
  licensingFailure: boolean;
  guidErrors: boolean;
  packageCacheCorrupt: boolean;
  importCompleted: boolean; // ArtifactDB timestamp advanced
}
```

The recovery router consults the full diagnostic object, not just `exitCode`. For example:

- `exitCode === -1 && runtimeSeconds < 60 && licensingFailure` → licensing retry (no Library change)
- `exitCode === -1 && crashEvidenceFound && !importCompleted` → two-phase import retry
- `exitCode === 0 && !buildMethodInvoked` → silent exit; timestamp race recovery
- `exitCode === -1 && crashEvidenceFound && importCompleted` → crash after successful import; nuke Library

### Dual-Log Capture (Tee Pattern)

Stream Unity output to both stdout (for the CI log, visible in Actions UI) and a file (for post-mortem inspection). The two streams serve different purposes:

- **Stdout stream**: Visible in the GitHub Actions job log in real time. Used for monitoring during a live run.
- **File stream**: Persists after the job completes. Used for post-mortem when the live log has already scrolled away or been compressed.

In PowerShell:

```powershell
$logFile = "Builds/Logs/Editor.log"
Start-Process Unity.exe -ArgumentList $args -RedirectStandardOutput $logFile
# Mirror to stdout via Register-ObjectEvent for async reading
```

In Node/TypeScript (orchestrator pattern), pipe Unity's output to both a `Writable` stream (file) and `process.stdout` simultaneously.

### Pre-Launch and Post-Launch Hooks

Structure the Unity execution wrapper around three phases with clear separation:

**Pre-launch hooks** (before `Unity.exe` starts):

- Zombie and orphan process cleanup (scoped by workspace path)
- Cache validation and skeleton detection
- `csc.rsp` injection for scripting define overrides
- HDRP define stripping from `ProjectSettings.asset`
- Auto-generated asset pre-flight deletion (InitializeOnLoad race prevention)
- Serialization lock acquisition for cold imports
- Hub and licensing client health check

**Unity execution:**

- Async stdout/stderr capture (no synchronous `ReadLine()` — pipe deadlock risk)
- Per-process timeout with kill on expiry
- Real-time log scanning for early termination signals (license failure within 60 seconds, crash evidence before import completes)

**Post-launch hooks** (after `Unity.exe` exits):

- Exit code capture before any other work
- Log preservation to a stable path (the default `Editor.log` location is overwritten on the next launch)
- Build diagnostic flag extraction from log
- Recovery routing based on diagnostic flags
- Cache save/discard decision (preserve Library? checkpoint partial? nuke and don't cache?)
- Satellite process cleanup (anything Unity spawned that outlived it)

This structure keeps recovery logic out of the Unity launch loop and makes each phase independently testable.

### Retry Budget Management

Each retry type has its own counter. Separate budgets prevent one failure mode from exhausting the overall retry allowance and blocking other handlers.

```typescript
const retryBudgets = {
  lfsPointer: { max: 1, used: 0 },
  licensingRace: { max: 2, used: 0 },
  twoPhaseImport: { max: 1, used: 0 },
  libraryNuke: { max: 1, used: 0 },
  packageCache: { max: 1, used: 0 },
};
```

A licensing retry (`licensingRace`) does not consume the crash recovery budget (`libraryNuke`). A two-phase import attempt does not prevent a subsequent licensing retry if the second launch also hits a licensing race.

---

## 10. Known Unity Version-Specific Issues

These are failure modes confirmed in production CI that game-ci users will encounter. They are not theoretical — each one caused real failures and required specific mitigations.

### Unity 6000.x — Personal License Activation

**Issue:** Unity 6 (6000.x) switched Personal license from floating serial keys to Named User licensing. There is no CLI serial activation for Personal license. The only supported activation path is Hub sign-in.

**Impact for game-ci:** Docker-based headless activation (which game-ci currently relies on for Personal license users via `-serial`, `-username`, `-password`) is fragile or unsupported on Unity 6000.x Personal. The `Unity.exe -batchmode -serial` flow may appear to succeed but leave the editor in an unlicensed state.

**Workarounds:**

- Use a Unity Pro or Plus license with serial activation (still supported in 6000.x)
- Use Unity Build Automation (formerly Cloud Build) for credential management
- Pre-activate the license by signing into Hub on a reference machine and committing the resulting license file — brittle but functional for locked-version setups

**Symptoms in logs:** `[Licensing::Module] No valid license` or `license.ulicx file not found` within the first 30 seconds of startup. Followed by Unity exiting with code 1 without any build output.

---

### Unity 6000.4.5f1 — ILPP Runner CLR Crash

**Issue:** `Unity.ILPP.Runner.exe` crashes with a .NET CLR exception (`0xe0434352` / `CLR exception`) during IL post-processing on certain assembly configurations. Observed specifically on Shell/Generic profiles where HDRP packages are stripped, leaving the Burst ILPP consumer without its expected dependency assemblies.

**Root cause:** The ILPP Runner cannot resolve assembly references that are absent in the stripped profile. Burst (`com.unity.burst`) submits ILPP work that references assemblies from packages on `branch: empty` (not initialized). The unresolvable references crash the Runner process.

**Mitigation:** Set `BURST_DISABLE_COMPILATION=1` as an environment variable for the Unity process. This prevents Burst from submitting ILPP work. On non-production builds (compile checks, test runs), Burst-optimized native code is not needed.

**Secondary mitigation:** Clear `Library/Bee/` before launch on profile switches. Stale ILPP compilation artifacts from a prior profile reference assemblies that may not be present in the current profile, causing the Runner to process stale work items.

**Symptoms in logs:** `Unity.ILPP.Runner.exe` exits with CLR exception code `0xe0434352` within 10–30 seconds of Unity launch. Unity exits `-1` with no domain reload logged.

---

### UPM Immutable Package Asset Corruption (Profile Switching)

**Issue:** `Library/PackageCache/` maintains an index mapping package GUIDs to package files. When the active package set changes (for example, switching from HDRP-on to HDRP-stripped), the cached index maps files to wrong packages. Unity cannot restore the immutable assets and fails with CS0246 compile errors that look like fresh-import GUID ordering issues.

**Smoking gun log message:**

```
Could not restore immutable package asset ...com.unity.render-pipelines.high-definition...
```

Followed by CS0246 errors where `UnityEditor.GUID` (from `UnityEditor.CoreModule`) cannot be resolved in HDRP editor assemblies. The UPM log shows HDRP files mapped to unrelated packages (for example, `com.unity.modules.accessibility`).

**Fix:** Clear `Library/PackageCache/` AND the global UPM cache (`%LOCALAPPDATA%\Unity\cache\packages\`) when a profile switch is detected. Partial removal of specific package directories is insufficient because the corruption is in the index layer, not the package files themselves.

**Prevention:** Include `Library/PackageCache/` in the profile fingerprint-gated cache clearing logic. When the fingerprint changes (different package set), clear PackageCache before Unity launches.

---

### InitializeOnLoad Asset Timestamp Race (All Versions)

**Issue:** `[InitializeOnLoad]` static constructors in third-party packages create or modify asset files during domain reload. Unity's SourceAssetDB records file timestamps during startup (before domain reload). When InitializeOnLoad modifies those files, the recorded timestamp no longer matches the disk timestamp. Unity aborts with a "Build asset version error" and exits code 0 without invoking the build method.

**Why this is subtle:** Unity exits 0 (success). The CI wrapper reports success. On persistent workspaces, old build artifacts from a previous run may still be present, so the build verification step finds the old executable and reports a green build — masking the fact that the current run produced nothing.

**Known offending packages (as of 2026-05-02):**

| Package                        | Version | Class                       | Asset                                   |
| ------------------------------ | ------- | --------------------------- | --------------------------------------- |
| `com.gemserk.selectionhistory` | 1.1.13  | `SelectionHistoryReference` | `Assets/Gemserk.SelectionHistory.asset` |
| `Kamgam.HitMe`                 | 1.2.0   | `HitMeSettings`             | `Assets/HitMeSettings.asset`            |

**Fix:** Delete the auto-generated asset AND `SourceAssetDB` before Unity launches. This forces InitializeOnLoad to recreate the asset within the same Unity session that builds SourceAssetDB — the recorded timestamp and the disk timestamp both come from the same session, so they match.

**Critical:** Do not pre-create the asset. InitializeOnLoad modifies the asset on domain reload regardless of whether it already exists. Pre-creation still produces a mismatch. Only deletion before launch works.

**Cross-session note:** If two separate Unity processes share the same Library (as in two-phase import retry), delete the asset AND SourceAssetDB between phases — InitializeOnLoad fires in every Unity launch, re-invalidating SourceAssetDB that was built in the previous phase.

---

### YAML OOM on Large Assets (All Versions)

**Issue:** Unity's YAML deserializer loads the entire file into memory during `InitialRefresh`. Assets with massive `SerializeReference` data (large ScriptableObjects, complex timeline assets, or serialized AI graphs) can balloon in memory during deserialization. On runners with 16–32 GB RAM, this causes OOM during import before any build method runs.

**Symptoms:** Unity exits `-1` or with a Windows OOM exit code (`0xC0000095`) during the import phase. ArtifactDB timestamp does not advance. The Unity log shows `InitialRefresh` starting but no completion message.

**Mitigations:**

- Split large `SerializeReference` assets into multiple smaller assets
- Use binary serialization for data-heavy assets (set `Asset Serialization Mode: Mixed` for specific asset types)
- Increase runner RAM if the project consistently hits this threshold
- Use `job-worker-count: 2` to reduce concurrent import worker threads (reduces peak memory)

---

### Win32 Menu Handle Exhaustion (All Versions, batchmode)

**Issue:** Each `[MenuItem]` attribute registered in the Unity Editor allocates a Win32 menu handle. In batchmode CI builds, Unity still processes all `[MenuItem]` attributes during domain reload. Projects with many editor tools, third-party packages, or generated menu items can exhaust the Windows desktop heap (`win32k.sys` menu handle limit).

**Symptoms:** `Not enough memory resources are available to process this command` in the Unity log during domain reload. Unity exits `-1`. The error is a Win32 system error, not a .NET OOM. Occurs consistently on the same domain reload step regardless of available RAM.

**Mitigations:**

- Wrap editor-only code with `#if UNITY_EDITOR` guards and avoid registering `[MenuItem]` in batchmode paths
- Use `UNITY_BATCH_MODE` scripting define to conditionally skip menu registration
- Increase the desktop heap allocation via registry (`HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\SubSystems\Windows` SharedSection parameter) — requires runner host access
- If using batchmode exclusively for CI, audit third-party packages for excessive menu registration and file issues upstream
