import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalCacheService } from './local-cache-service';
import OrchestratorLogger from '../core/orchestrator-logger';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawn: spawnMock,
}));
vi.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), logWarning: vi.fn(), error: vi.fn() },
}));

const deadPid = 999_999_999;

/** LocalCacheService against a real filesystem, for what mocked fs calls cannot show. */
describe('LocalCacheService on disk', () => {
  let root: string;
  let projectPath: string;
  let cacheRoot: string;
  let cachePath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-cache-fs-'));
    projectPath = path.join(root, 'project');
    cacheRoot = path.join(root, 'cache');
    cachePath = path.join(cacheRoot, 'key1', 'Library');
    fs.mkdirSync(path.join(projectPath, 'Library', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'Library', 'ArtifactDB'), 'new');
    fs.writeFileSync(path.join(projectPath, 'Library', 'nested', 'b.asset'), 'b');
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('backgroundSaveScript', () => {
    function runScript(): void {
      const lockPath = path.join(cacheRoot, 'key1', '.game-ci-cache-save.lock');
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      fs.writeFileSync(lockPath, 'pending');
      const script = LocalCacheService.backgroundSaveScript(
        path.join(projectPath, 'Library'),
        cachePath,
        lockPath,
      );

      try {
        execFileSync(process.execPath, ['-e', script], { stdio: 'pipe' });
      } finally {
        expect(fs.existsSync(lockPath)).toBe(false);
      }
    }

    it('replaces the previous entry with a complete copy and leaves nothing beside it', () => {
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'ArtifactDB'), 'old');

      runScript();

      expect(fs.readFileSync(path.join(cachePath, 'ArtifactDB'), 'utf8')).toBe('new');
      expect(fs.readFileSync(path.join(cachePath, 'nested', 'b.asset'), 'utf8')).toBe('b');
      expect(fs.readdirSync(path.dirname(cachePath))).toEqual(['Library']);
      expect(fs.existsSync(path.join(projectPath, 'Library', 'ArtifactDB'))).toBe(true);
    });

    it('keeps the previous entry and removes its staging copy when the copy fails', () => {
      fs.mkdirSync(cachePath, { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'ArtifactDB'), 'old');
      fs.rmSync(path.join(projectPath, 'Library'), { recursive: true });

      expect(() => runScript()).toThrow();

      expect(fs.readFileSync(path.join(cachePath, 'ArtifactDB'), 'utf8')).toBe('old');
      expect(fs.readdirSync(path.dirname(cachePath))).toEqual(['Library']);
    });
  });

  it('falls back to a staged synchronous copy when the background save cannot spawn', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('EAGAIN: spawn failed');
    });

    await LocalCacheService.saveEngineCache(projectPath, cacheRoot, 'key1', {
      saveMode: 'copy-directory',
      backgroundSave: true,
    });

    expect(spawnMock).toHaveBeenCalled();
    expect(fs.readFileSync(path.join(cachePath, 'nested', 'b.asset'), 'utf8')).toBe('b');
    expect(fs.readdirSync(path.dirname(cachePath))).toEqual(['Library']);
  });

  it('sweeps staging and tombstone directories abandoned by a dead process', () => {
    const keyPath = path.join(cacheRoot, 'key1');
    const abandoned = [`.Library.partial-${deadPid}-abc`, `.Library.removing-${deadPid}-abc`];
    for (const name of abandoned)
      fs.mkdirSync(path.join(keyPath, name, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(keyPath, `.Library.partial-${process.pid}-abc`));
    fs.mkdirSync(cachePath);

    LocalCacheService.sweepStaleLocks(cacheRoot);

    expect(fs.readdirSync(keyPath).sort()).toEqual([
      `.Library.partial-${process.pid}-abc`,
      'Library',
    ]);
  });

  it('warns about an abandoned copy it cannot remove', () => {
    const stuck = path.join(cacheRoot, 'key1', `.Library.removing-${deadPid}-abc`);
    fs.mkdirSync(stuck, { recursive: true });
    const realRm = fs.rmSync;
    vi.spyOn(fs, 'rmSync').mockImplementation((target, options) => {
      if (target === stuck) throw new Error('EACCES: permission denied');
      realRm(target, options);
    });

    LocalCacheService.sweepStaleLocks(cacheRoot);

    expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
      `[LocalCache] Failed to sweep abandoned copy ${stuck}: EACCES: permission denied`,
    );
  });
});
