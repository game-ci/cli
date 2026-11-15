/**
 * Resolves the cache mode both entry points (the GitHub Action and
 * `game-ci orchestrate`) run with: `cacheMode` first, then its deprecated alias
 * `localCacheMode`, then `move-directory`. The removed `canonical-overlay` mode
 * fails loudly rather than silently running as a directory move.
 */
export function resolveCacheMode(cacheMode?: string, legacyLocalCacheMode?: string): string {
  const mode = cacheMode || legacyLocalCacheMode || 'move-directory';

  if (mode === 'canonical-overlay') {
    throw new Error(
      'cacheMode: canonical-overlay has been removed. ' +
        "Use 'move-directory' (recommended for retained runners/build farms) or 'tar' " +
        '(recommended for remote/ephemeral caches, or combine with rclone/S3 built-in ' +
        'container hooks - see the caching docs for details).',
    );
  }

  return mode;
}
