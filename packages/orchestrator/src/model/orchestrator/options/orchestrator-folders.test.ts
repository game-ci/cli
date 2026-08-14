import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { OrchestratorFolders } from './orchestrator-folders';

// Mock Orchestrator
vi.mock('../orchestrator', () => ({
  __esModule: true,
  default: {
    buildParameters: {
      buildGuid: 'test-guid-abc',
      cacheKey: 'my-cache-key',
      projectPath: 'test-project',
      buildPath: 'Builds',
      maxRetainedWorkspaces: 0,
      gitPrivateToken: 'ghp_test123',
      gitAuthMode: 'url',
      orchestratorRepoName: 'game-ci/unity-builder',
      githubRepo: 'user/my-game',
    },
    lockedWorkspace: '',
  },
}));

vi.mock('../../build-parameters', () => ({
  __esModule: true,
  default: {
    shouldUseRetainedWorkspaceMode: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('./orchestrator-options', () => ({
  __esModule: true,
  default: {
    useSharedBuilder: false,
  },
}));

// Normalize paths for cross-platform test compatibility
const normalize = (p: string) => p.replace(/\\/g, '/');

describe('OrchestratorFolders', () => {
  describe('static constants', () => {
    it('repositoryFolder is "repo"', () => {
      expect(OrchestratorFolders.repositoryFolder).toBe('repo');
    });

    it('buildVolumeFolder is "data"', () => {
      expect(OrchestratorFolders.buildVolumeFolder).toBe('data');
    });

    it('cacheFolder is "cache"', () => {
      expect(OrchestratorFolders.cacheFolder).toBe('cache');
    });
  });

  describe('ToLinuxFolder', () => {
    it('converts backslashes to forward slashes', () => {
      expect(OrchestratorFolders.ToLinuxFolder('C:\\Users\\test\\project')).toBe(
        'C:/Users/test/project',
      );
    });

    it('preserves forward slashes', () => {
      expect(OrchestratorFolders.ToLinuxFolder('/home/user/project')).toBe('/home/user/project');
    });

    it('handles mixed slashes', () => {
      expect(OrchestratorFolders.ToLinuxFolder('some/path\\mixed/slashes\\here')).toBe(
        'some/path/mixed/slashes/here',
      );
    });

    it('handles empty string', () => {
      expect(OrchestratorFolders.ToLinuxFolder('')).toBe('');
    });
  });

  describe('path computations (non-retained workspace mode)', () => {
    it('uniqueOrchestratorJobFolderAbsolute uses buildGuid', () => {
      const result = normalize(OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc');
    });

    it('cacheFolderForAllFull returns /data/cache', () => {
      const result = normalize(OrchestratorFolders.cacheFolderForAllFull);
      expect(result).toBe('/data/cache');
    });

    it('cacheFolderForCacheKeyFull includes cache key', () => {
      const result = normalize(OrchestratorFolders.cacheFolderForCacheKeyFull);
      expect(result).toBe('/data/cache/my-cache-key');
    });

    it('repoPathAbsolute is under job folder', () => {
      const result = normalize(OrchestratorFolders.repoPathAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo');
    });

    it('projectPathAbsolute includes project path', () => {
      const result = normalize(OrchestratorFolders.projectPathAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/test-project');
    });

    it('libraryFolderAbsolute is under project path', () => {
      const result = normalize(OrchestratorFolders.libraryFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/test-project/Library');
    });

    it('projectBuildFolderAbsolute uses buildPath', () => {
      const result = normalize(OrchestratorFolders.projectBuildFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/Builds');
    });

    it('lfsFolderAbsolute is under .git/lfs', () => {
      const result = normalize(OrchestratorFolders.lfsFolderAbsolute);
      expect(result).toBe('/data/test-guid-abc/repo/.git/lfs');
    });

    it('lfsCacheFolderFull is under cache key', () => {
      const result = normalize(OrchestratorFolders.lfsCacheFolderFull);
      expect(result).toBe('/data/cache/my-cache-key/lfs');
    });

    it('libraryCacheFolderFull is under cache key', () => {
      const result = normalize(OrchestratorFolders.libraryCacheFolderFull);
      expect(result).toBe('/data/cache/my-cache-key/Library');
    });
  });

  describe('builderPathAbsolute', () => {
    it('uses job folder when shared builder is disabled', () => {
      const result = normalize(OrchestratorFolders.builderPathAbsolute);
      expect(result).toBe('/data/test-guid-abc/builder');
    });
  });

  describe('repo URLs', () => {
    it('unityBuilderRepoUrl includes token and repo name', () => {
      const url = OrchestratorFolders.unityBuilderRepoUrl;
      expect(url).toBe('https://ghp_test123@github.com/game-ci/unity-builder.git');
    });

    it('targetBuildRepoUrl includes token and github repo', () => {
      const url = OrchestratorFolders.targetBuildRepoUrl;
      expect(url).toBe('https://ghp_test123@github.com/user/my-game.git');
    });
  });

  describe('cloneBuilderScript', () => {
    it('includes the _clean_clone_dest helper definition', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      expect(script).toContain('_clean_clone_dest()');
      expect(script).toContain('rm -rf "$CLONE_DEST"');
      expect(script).toContain('mkdir -p "$CLONE_DEST"');
    });

    it('cleans CLONE_DEST before the primary clone attempt', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      // The primary branch (after the authenticated probe success guard)
      // must call _clean_clone_dest immediately before the clone so a
      // re-entry against a stale dir starts fresh.
      const lines = script.split('\n').map((l) => l.trim());
      const probeGuardIndex = lines.findIndex((l) => l.startsWith('if _probe_authenticated'));
      const primaryCloneIndex = lines.findIndex(
        (l, index) =>
          index > probeGuardIndex &&
          l.startsWith('git clone -q -b "$BRANCH" "$REPO" "$CLONE_DEST"'),
      );
      const cleanIndex = lines.findIndex(
        (l, index) =>
          index > probeGuardIndex && index < primaryCloneIndex && l === '_clean_clone_dest',
      );
      expect(probeGuardIndex).toBeGreaterThanOrEqual(0);
      expect(primaryCloneIndex).toBeGreaterThan(probeGuardIndex);
      expect(cleanIndex).toBeGreaterThan(probeGuardIndex);
      expect(cleanIndex).toBeLessThan(primaryCloneIndex);
    });

    it('chains _clean_clone_dest before each unauthenticated fallback clone', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      // Every variant in the unauth-fallback chain must clean first.
      // Three || -chained variants, each wrapped in ( _clean_clone_dest && git clone ... ).
      const matches = script.match(/_clean_clone_dest && git clone -q/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('preserves the authenticated-clone-failed log message on the unauthenticated fallback branch', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      // The legacy message only appears on the public-repo fallback path
      // (GIT_PRIVATE_TOKEN unset). The private-repo path now fails loudly
      // with a different message (covered by its own test below).
      expect(script).toContain('Authenticated clone failed; retrying without credentials');
    });

    // -------------------------------------------------------------------
    // Auth fallback fix (downstream issue #11, 2026-05-17)
    // -------------------------------------------------------------------

    it('uses a bounded retry-with-backoff probe instead of a single inline ls-remote', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      // The old script used `if [ -n "$(git ls-remote --heads ... 2>/dev/null)" ]`
      // as the only probe. The fixed script wraps the probe in a function with
      // bounded retry-with-backoff so transient ls-remote failures do not
      // immediately cascade into the (misleading) auth-failure fallback.
      expect(script).toContain('_probe_authenticated()');
      expect(script).toContain('max_attempts=3');
      expect(script).toContain('if _probe_authenticated; then');
    });

    it('surfaces ls-remote stderr to the job log on each retry attempt', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      // The previous script swallowed stderr (`2>/dev/null`), hiding the
      // actual failure class (auth / network / DNS). The fix surfaces
      // stderr with a [clone-stderr] prefix for triage.
      expect(script).toContain('[clone-stderr]');
      expect(script).toContain('git ls-remote --heads "$REPO" "$BRANCH" 2>&1');
    });

    it('fails loudly on private repos when authenticated clone fails (does NOT try unauthenticated)', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      // When GIT_PRIVATE_TOKEN is set the repo is private; unauthenticated
      // fallback CANNOT succeed (git prompts for a username with no TTY
      // available). The fix gates the unauth chain on GIT_PRIVATE_TOKEN
      // being absent and fails loudly with the captured authenticated
      // clone stderr when the token is set.
      expect(script).toContain('elif [ -n "$GIT_PRIVATE_TOKEN" ]; then');
      expect(script).toContain('FATAL: authenticated clone failed against private repo');
      expect(script).toContain(
        'Skipping unauthenticated fallback because GIT_PRIVATE_TOKEN is set',
      );
      // The fatal branch must end with `exit 1` -- a script that fails to
      // clone the builder MUST not continue execution against an empty
      // /data/builder.
      const lines = script.split('\n').map((l) => l.trim());
      const fatalBranchStart = lines.findIndex(
        (l) => l === 'elif [ -n "$GIT_PRIVATE_TOKEN" ]; then',
      );
      const exitIndex = lines.findIndex((l, index) => index > fatalBranchStart && l === 'exit 1');
      const elseIndex = lines.findIndex((l, index) => index > fatalBranchStart && l === 'else');
      expect(exitIndex).toBeGreaterThan(fatalBranchStart);
      expect(exitIndex).toBeLessThan(elseIndex);
    });

    it('still attempts the unauthenticated fallback chain when GIT_PRIVATE_TOKEN is absent (public-repo case)', () => {
      const script = OrchestratorFolders.cloneBuilderScript('/data/builder');
      // The else branch (public-repo case) must still unset extraHeader and
      // run the three-variant unauthenticated fallback. This preserves
      // behaviour for public repos.
      expect(script).toContain(
        'Authenticated clone failed; retrying without credentials (GIT_PRIVATE_TOKEN is not set -- assuming public repo)',
      );
      expect(script).toContain(
        'git config --global --unset-all http.https://github.com/.extraHeader',
      );
      // Three unauthenticated variants on REPO_PLAIN.
      const unauthCloneMatches = script.match(/git clone -q (?:-b [^ ]+ )?"\$REPO_PLAIN"/g) || [];
      expect(unauthCloneMatches.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('purgeRemoteCaching', () => {
    it('returns false when env var is not set', () => {
      const original = process.env.PURGE_REMOTE_BUILDER_CACHE;
      delete process.env.PURGE_REMOTE_BUILDER_CACHE;
      expect(OrchestratorFolders.purgeRemoteCaching).toBe(false);
      if (original !== undefined) process.env.PURGE_REMOTE_BUILDER_CACHE = original;
    });

    it('returns true when env var is set', () => {
      const original = process.env.PURGE_REMOTE_BUILDER_CACHE;
      process.env.PURGE_REMOTE_BUILDER_CACHE = 'true';
      expect(OrchestratorFolders.purgeRemoteCaching).toBe(true);
      if (original !== undefined) {
        process.env.PURGE_REMOTE_BUILDER_CACHE = original;
      } else {
        delete process.env.PURGE_REMOTE_BUILDER_CACHE;
      }
    });
  });

  describe('repoPathOverride', () => {
    // The Orchestrator mock is hoisted to module scope; mutate its
    // buildParameters in-place to flip the override on/off per-test and
    // restore after so the rest of the suite stays on the default layout.
    let OrchestratorMock: { buildParameters: Record<string, any> };

    beforeAll(async () => {
      OrchestratorMock = (await import('../orchestrator')).default as {
        buildParameters: Record<string, any>;
      };
    });

    afterEach(() => {
      delete OrchestratorMock.buildParameters.repoPathOverride;
    });

    it('returns the override verbatim when set', () => {
      OrchestratorMock.buildParameters.repoPathOverride = '/data';
      expect(normalize(OrchestratorFolders.repoPathAbsolute)).toBe('/data');
    });

    it('cascades the override through projectPathAbsolute', () => {
      OrchestratorMock.buildParameters.repoPathOverride = '/data';
      expect(normalize(OrchestratorFolders.projectPathAbsolute)).toBe('/data/test-project');
    });

    it('cascades the override through libraryFolderAbsolute', () => {
      OrchestratorMock.buildParameters.repoPathOverride = '/data';
      expect(normalize(OrchestratorFolders.libraryFolderAbsolute)).toBe(
        '/data/test-project/Library',
      );
    });

    it('cascades the override through projectBuildFolderAbsolute', () => {
      OrchestratorMock.buildParameters.repoPathOverride = '/data';
      expect(normalize(OrchestratorFolders.projectBuildFolderAbsolute)).toBe('/data/Builds');
    });

    it('cascades the override through lfsFolderAbsolute', () => {
      OrchestratorMock.buildParameters.repoPathOverride = '/data';
      expect(normalize(OrchestratorFolders.lfsFolderAbsolute)).toBe('/data/.git/lfs');
    });

    it('falls back to the default layout when override is empty string', () => {
      OrchestratorMock.buildParameters.repoPathOverride = '';
      expect(normalize(OrchestratorFolders.repoPathAbsolute)).toBe('/data/test-guid-abc/repo');
    });

    it('falls back to the default layout when override is unset', () => {
      delete OrchestratorMock.buildParameters.repoPathOverride;
      expect(normalize(OrchestratorFolders.repoPathAbsolute)).toBe('/data/test-guid-abc/repo');
    });

    it('does not affect cacheFolderForCacheKeyFull (cache layout is independent of override)', () => {
      OrchestratorMock.buildParameters.repoPathOverride = '/data';
      // Cache paths intentionally stay anchored to uniqueOrchestratorJobFolderAbsolute --
      // documenting this so a future regression that silently re-routes cache
      // through the override fires this test.
      expect(normalize(OrchestratorFolders.cacheFolderForCacheKeyFull)).toBe(
        '/data/cache/my-cache-key',
      );
    });
  });
});
