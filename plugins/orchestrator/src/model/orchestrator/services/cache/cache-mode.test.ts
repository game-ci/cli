import { describe, expect, it } from 'vitest';
import { resolveCacheMode } from './cache-mode';

describe('resolveCacheMode', () => {
  it('defaults to move-directory', () => {
    expect(resolveCacheMode()).toBe('move-directory');
    expect(resolveCacheMode('', '')).toBe('move-directory');
  });

  it('prefers cacheMode over the deprecated localCacheMode', () => {
    expect(resolveCacheMode('tar', 'copy-directory')).toBe('tar');
    expect(resolveCacheMode('', 'copy-directory')).toBe('copy-directory');
  });

  it('rejects an unknown mode instead of running it as a directory move', () => {
    expect(() => resolveCacheMode('move-dir')).toThrow("unknown mode 'move-dir'");
    expect(() => resolveCacheMode('', 'Tar')).toThrow("unknown mode 'Tar'");
  });

  it('rejects the removed canonical-overlay mode, also through the deprecated alias', () => {
    expect(() => resolveCacheMode('canonical-overlay')).toThrow(
      'canonical-overlay has been removed',
    );
    expect(() => resolveCacheMode('', 'canonical-overlay')).toThrow(
      'canonical-overlay has been removed',
    );
  });
});
