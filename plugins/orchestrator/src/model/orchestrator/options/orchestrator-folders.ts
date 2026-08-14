import path from 'node:path';
import OrchestratorOptions from './orchestrator-options';
import Orchestrator from '../orchestrator';
import BuildParameters from '../../build-parameters';
import { getEngine } from '../../engine';

export class OrchestratorFolders {
  public static readonly repositoryFolder = 'repo';

  public static ToLinuxFolder(folder: string) {
    return folder.replace(/\\/g, `/`);
  }

  // Only the following paths that do not start a path.join with another "Full" suffixed property need to start with an absolute /

  public static get uniqueOrchestratorJobFolderAbsolute(): string {
    return Orchestrator.buildParameters &&
      BuildParameters.shouldUseRetainedWorkspaceMode(Orchestrator.buildParameters)
      ? path.join(`/`, OrchestratorFolders.buildVolumeFolder, Orchestrator.lockedWorkspace)
      : path.join(
          `/`,
          OrchestratorFolders.buildVolumeFolder,
          Orchestrator.buildParameters.buildGuid,
        );
  }

  public static get cacheFolderForAllFull(): string {
    return path.join('/', OrchestratorFolders.buildVolumeFolder, OrchestratorFolders.cacheFolder);
  }

  public static get cacheFolderForCacheKeyFull(): string {
    return path.join(
      '/',
      OrchestratorFolders.buildVolumeFolder,
      OrchestratorFolders.cacheFolder,
      Orchestrator.buildParameters.cacheKey,
    );
  }

  public static get builderPathAbsolute(): string {
    return path.join(
      OrchestratorOptions.useSharedBuilder
        ? `/${OrchestratorFolders.buildVolumeFolder}`
        : OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute,
      `builder`,
    );
  }

  public static get repoPathAbsolute(): string {
    // repoPathOverride: when set, bypass the default
    //   ${uniqueOrchestratorJobFolderAbsolute}/${repositoryFolder}
    // layout and return the caller-supplied path verbatim. Intended to be
    // paired with skipInContainerClone so a pre-hydrated workspace already
    // bind-mounted at a fixed container path (typically /data, the default
    // local-docker bind-mount target) can be reused without re-cloning.
    //
    // Companion code in RemoteClient.bootstrapRepository enforces that
    // repoPathOverride is only honoured when skipInContainerClone is also
    // set, so the divergent cache/builder layout that would result from a
    // non-skip path is rejected at bootstrap with a loud error rather than
    // silently producing a misconfigured run.
    const override = Orchestrator.buildParameters?.repoPathOverride;
    if (override) {
      return override;
    }

    return path.join(
      OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute,
      OrchestratorFolders.repositoryFolder,
    );
  }

  public static get projectPathAbsolute(): string {
    return path.join(
      OrchestratorFolders.repoPathAbsolute,
      Orchestrator.buildParameters.projectPath,
    );
  }

  public static engineCacheFolderAbsolute(folder: string): string {
    return path.join(OrchestratorFolders.projectPathAbsolute, folder);
  }

  /** @deprecated Use engineCacheFolderAbsolute(folder) — kept for backward compatibility */
  public static get libraryFolderAbsolute(): string {
    return OrchestratorFolders.engineCacheFolderAbsolute(getEngine().cacheFolders[0] || 'Library');
  }

  public static get projectBuildFolderAbsolute(): string {
    return path.join(OrchestratorFolders.repoPathAbsolute, Orchestrator.buildParameters.buildPath);
  }

  public static get lfsFolderAbsolute(): string {
    return path.join(OrchestratorFolders.repoPathAbsolute, `.git`, `lfs`);
  }

  public static get purgeRemoteCaching(): boolean {
    return process.env.PURGE_REMOTE_BUILDER_CACHE !== undefined;
  }

  public static get lfsCacheFolderFull() {
    return path.join(OrchestratorFolders.cacheFolderForCacheKeyFull, `lfs`);
  }

  public static engineCacheFolderFull(folder: string) {
    return path.join(OrchestratorFolders.cacheFolderForCacheKeyFull, folder);
  }

  /** @deprecated Use engineCacheFolderFull(folder) — kept for backward compatibility */
  public static get libraryCacheFolderFull() {
    return OrchestratorFolders.engineCacheFolderFull(getEngine().cacheFolders[0] || 'Library');
  }

  /**
   * Whether to use http.extraHeader for git authentication (secure, default)
   * instead of embedding the token in clone URLs (legacy).
   */
  public static get useHeaderAuth(): boolean {
    return Orchestrator.buildParameters.gitAuthMode !== 'url';
  }

  public static get unityBuilderRepoUrl(): string {
    if (OrchestratorFolders.useHeaderAuth) {
      return `https://github.com/${Orchestrator.buildParameters.orchestratorRepoName}.git`;
    }

    return `https://${Orchestrator.buildParameters.gitPrivateToken}@github.com/${Orchestrator.buildParameters.orchestratorRepoName}.git`;
  }

  public static get targetBuildRepoUrl(): string {
    if (OrchestratorFolders.useHeaderAuth) {
      return `https://github.com/${Orchestrator.buildParameters.githubRepo}.git`;
    }

    return `https://${Orchestrator.buildParameters.gitPrivateToken}@github.com/${Orchestrator.buildParameters.githubRepo}.git`;
  }

  /**
   * Shell commands to configure git authentication via http.extraHeader.
   * Uses GIT_PRIVATE_TOKEN env var so the token never appears in clone URLs or git config output.
   * This is the same mechanism used by actions/checkout.
   *
   * Only emits commands when gitAuthMode is 'header' (default). In 'url' mode,
   * returns a no-op comment since the token is already in the URL.
   */
  /**
   * Shell script to clone the orchestrator/builder repo with multi-branch
   * fallback and credential recovery. Used by both build-automation and
   * async workflows.
   */
  public static cloneBuilderScript(dest: string): string {
    const repoName = Orchestrator.buildParameters.orchestratorRepoName;
    // Clean $CLONE_DEST before every clone attempt. The if/elif/else chain
    // below can leave $CLONE_DEST partially populated if an earlier clone
    // started but did not complete (network blip, broken pipe, auth probe
    // race against `git ls-remote --heads ...`). A subsequent clone variant
    // against the now-non-empty directory fails with:
    //   fatal: destination path '...' already exists and is not an empty
    //   directory.
    // `rm -rf ... 2>/dev/null || true` is idempotent on a fresh dir and
    // safe to invoke repeatedly. Confirmed failure mode in downstream
    // run 25998432649 (frostebite/GameClient, 2026-05-17): 6.5-minute
    // container lifetime spent in the retry loop before the final clone
    // fatalled on the partial-populate from earlier attempts.
    //
    // Auth fallback semantics (fixed 2026-05-17, downstream issue #11):
    //
    // Previously, every probe and clone redirected stderr to /dev/null and
    // the `else` branch silently dropped the http.extraHeader credentials
    // and retried with unauthenticated URLs. For private repos with
    // GIT_PRIVATE_TOKEN set, the unauth retry CANNOT succeed -- git fails
    // with `fatal: could not read Username for 'https://github.com': No
    // such device or address` (no TTY in container). The cumulative
    // ~3-minute timeout chain produced a misleading "Build failed with
    // exit code 128" with no diagnostic on what actually failed in the
    // authenticated probe. Downstream evidence: GameClient diagnostic run
    // 26000379491 (2026-05-17) -- DNS, HTTPS, PAT length, extraHeader all
    // verified correct via a parallel manual diagnostic; the only failure
    // is this template's swallowing of the actual ls-remote error.
    //
    // The fix:
    //  1. Surface stderr from the ls-remote probe to the job log (no more
    //     `2>/dev/null` on the probe) so the actual failure class (auth?
    //     network? DNS?) is visible.
    //  2. Add a bounded retry-with-backoff on the authenticated path (3
    //     attempts, 2s + 4s sleeps) so transient network blips do not
    //     misclassify as auth failures.
    //  3. Gate the unauthenticated fallback on GIT_PRIVATE_TOKEN being
    //     ABSENT. When the token is set we know the repo is private; the
    //     unauth retry is wrong by construction and only masks the real
    //     auth failure with a misleading TTY-prompt error. When the token
    //     is absent the repo is assumed public and the existing chain is
    //     preserved (no behaviour change for that case).
    return `BRANCH="${Orchestrator.buildParameters.orchestratorBranch}"
REPO="${OrchestratorFolders.unityBuilderRepoUrl}"
REPO_PLAIN="https://github.com/${repoName}.git"
CLONE_DEST="${dest}"
# Detect-and-skip-if-present: when the caller has pre-populated the builder
# destination (typically via a bind-mount from the host) and the compiled
# entrypoint at $CLONE_DEST/dist/index.js already exists, skip the
# in-container clone+build entirely. This is backwards-compatible: callers
# that do not pre-populate $CLONE_DEST see the full clone chain unchanged.
# Pairs with --skipInContainerClone for self-hosted setups where the host
# already holds the orchestrator builder dist; in those setups the
# in-container clone is either redundant (extra network IO) or fatal
# (private-repo auth when the in-container credentials are intentionally
# not provisioned). The entire clone block runs in the else branch.
if [ -f "$CLONE_DEST/dist/index.js" ]; then
  echo "[clone] Builder dist already present at $CLONE_DEST/dist/index.js -- skipping in-container clone+build (host pre-populated)"
else
_clean_clone_dest() { rm -rf "$CLONE_DEST" 2>/dev/null || true; mkdir -p "$CLONE_DEST" 2>/dev/null || true; }
# Authenticated ls-remote probe with bounded retry-with-backoff. Stderr is
# surfaced to the job log on each attempt so the actual failure class
# (auth / network / DNS / transient) is visible. Empty output on success
# is acceptable -- only the exit code is consulted.
_probe_authenticated() {
  local attempt=1
  local max_attempts=3
  while [ $attempt -le $max_attempts ]; do
    if git ls-remote --heads "$REPO" "$BRANCH" >/dev/null 2>&1; then
      return 0
    fi
    if [ $attempt -lt $max_attempts ]; then
      local backoff=$((attempt * 2))
      echo "[clone] ls-remote probe attempt $attempt/$max_attempts failed -- retrying in \${backoff}s. Stderr from this attempt:"
      git ls-remote --heads "$REPO" "$BRANCH" 2>&1 | sed 's/^/[clone-stderr] /' || true
      sleep $backoff
    else
      echo "[clone] ls-remote probe attempt $attempt/$max_attempts failed -- giving up. Final stderr:"
      git ls-remote --heads "$REPO" "$BRANCH" 2>&1 | sed 's/^/[clone-stderr] /' || true
    fi
    attempt=$((attempt + 1))
  done
  return 1
}
if _probe_authenticated; then
  _clean_clone_dest
  git clone -q -b "$BRANCH" "$REPO" "$CLONE_DEST"
elif _clean_clone_dest && git clone -q -b main "$REPO" "$CLONE_DEST" 2>/dev/null; then
  echo "Cloned default branch from $REPO"
elif [ -n "$GIT_PRIVATE_TOKEN" ]; then
  # GIT_PRIVATE_TOKEN is set -> repo is private. Unauthenticated fallback
  # CANNOT succeed (git prompts for a username with no TTY available and
  # fails with "could not read Username for 'https://github.com'"). Fail
  # loudly here so the real auth failure is the visible error, not the
  # misleading downstream TTY-prompt error. Stderr from a final authenticated
  # clone attempt is captured for diagnosis.
  echo "[clone] FATAL: authenticated clone failed against private repo (GIT_PRIVATE_TOKEN is set). Final stderr from authenticated clone attempt:"
  _clean_clone_dest
  git clone -b "$BRANCH" "$REPO" "$CLONE_DEST" 2>&1 | sed 's/^/[clone-stderr] /' || true
  echo "[clone] Skipping unauthenticated fallback because GIT_PRIVATE_TOKEN is set (private repo). Inspect the [clone-stderr] lines above to diagnose the auth failure (token scope, token expiry, repo access, network, or DNS)."
  exit 1
else
  echo "Authenticated clone failed; retrying without credentials (GIT_PRIVATE_TOKEN is not set -- assuming public repo)"
  git config --global --unset-all http.https://github.com/.extraHeader 2>/dev/null || true
  ( _clean_clone_dest && git clone -q -b "$BRANCH" "$REPO_PLAIN" "$CLONE_DEST" 2>/dev/null ) \\
    || ( _clean_clone_dest && git clone -q -b main "$REPO_PLAIN" "$CLONE_DEST" 2>/dev/null ) \\
    || ( _clean_clone_dest && git clone -q "$REPO_PLAIN" "$CLONE_DEST" )
fi
fi`;
  }

  public static get gitAuthConfigScript(): string {
    if (!OrchestratorFolders.useHeaderAuth) {
      return `# git auth: using token-in-URL mode (legacy)`;
    }

    return `# git auth: configuring http.extraHeader (secure mode)
if [ -n "$GIT_PRIVATE_TOKEN" ]; then
  git config --global http.https://github.com/.extraHeader "Authorization: Basic $(printf '%s' "x-access-token:$GIT_PRIVATE_TOKEN" | base64 -w 0)"
fi`;
  }

  /**
   * Configure git authentication via http.extraHeader in the current Node process.
   * For use in the remote-client where shell scripts aren't used.
   * Only configures when gitAuthMode is 'header' (default).
   */
  public static async configureGitAuth(): Promise<void> {
    if (!OrchestratorFolders.useHeaderAuth) return;

    const token =
      Orchestrator.buildParameters.gitPrivateToken || process.env.GIT_PRIVATE_TOKEN || '';
    if (!token) return;

    const encoded = Buffer.from(`x-access-token:${token}`).toString('base64');
    const { OrchestratorSystem } = await import('../services/core/orchestrator-system');
    await OrchestratorSystem.Run(
      `git config --global http.https://github.com/.extraHeader "Authorization: Basic ${encoded}"`,
    );
  }

  public static get buildVolumeFolder() {
    return 'data';
  }

  public static get cacheFolder() {
    return 'cache';
  }
}
