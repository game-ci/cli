import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyIntoPlace,
  moveDirectory,
  removeDirectory,
  sweepAbandonedLeftovers,
} from './move-directory';

function renameError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: rename refused`), { code });
}

/** Restores write access everywhere below a directory, so a test can clean it up. */
function makeWritable(directory: string): void {
  fs.chmodSync(directory, 0o755);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) makeWritable(path.join(directory, entry.name));
  }
}

describe('moveDirectory', () => {
  let root: string;
  let source: string;
  let destination: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'move-directory-'));
    source = path.join(root, 'Library');
    destination = path.join(root, 'cache', 'Library');
    fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(source, 'a.asset'), 'a');
    fs.writeFileSync(path.join(source, 'nested', 'b.asset'), 'b');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  /** Fails only the first rename (source -> destination); later renames run for real. */
  function refuseFirstRename(code: string) {
    const realRename = fs.renameSync;
    let refused = false;

    return vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (!refused) {
        refused = true;
        throw renameError(code);
      }
      realRename(from, to);
    });
  }

  it('moves with a rename when the OS allows it', () => {
    expect(moveDirectory(source, destination)).toEqual({ method: 'rename' });
    expect(fs.readFileSync(path.join(destination, 'nested', 'b.asset'), 'utf8')).toBe('b');
    expect(fs.existsSync(source)).toBe(false);
  });

  it.each(['EXDEV', 'EPERM'])(
    'copies into place and removes the source when rename fails with %s',
    (code) => {
      refuseFirstRename(code);

      expect(moveDirectory(source, destination)).toEqual({ method: 'copy', renameError: code });
      expect(fs.readFileSync(path.join(destination, 'a.asset'), 'utf8')).toBe('a');
      expect(fs.readFileSync(path.join(destination, 'nested', 'b.asset'), 'utf8')).toBe('b');
      expect(fs.existsSync(source)).toBe(false);
      expect(fs.readdirSync(path.dirname(destination))).toEqual(['Library']);
    },
  );

  it.each(['EXDEV', 'EPERM'])(
    'leaves no partial destination and keeps the source when the %s copy fails',
    (code) => {
      refuseFirstRename(code);
      const realCp = fs.cpSync;
      vi.spyOn(fs, 'cpSync').mockImplementation((from, to, options) => {
        realCp(path.join(String(from), 'a.asset'), path.join(String(to), 'a.asset'), options);
        throw new Error('ENOSPC: no space left on device');
      });

      expect(() => moveDirectory(source, destination)).toThrow('ENOSPC');
      expect(fs.existsSync(destination)).toBe(false);
      expect(fs.readdirSync(path.dirname(destination))).toEqual([]);
      expect(fs.readFileSync(path.join(source, 'nested', 'b.asset'), 'utf8')).toBe('b');
    },
  );

  it('reports, rather than throws, a source that cannot be removed after a complete copy', () => {
    refuseFirstRename('EXDEV');
    vi.spyOn(fs, 'rmSync').mockImplementationOnce(() => {
      throw new Error('EBUSY: resource busy');
    });

    const move = moveDirectory(source, destination);

    expect(move).toEqual({
      method: 'copy',
      renameError: 'EXDEV',
      sourceCleanupError: expect.stringMatching(
        /^EBUSY: resource busy; left .*\.Library\.removing-/,
      ),
    });
    expect(fs.readFileSync(path.join(destination, 'a.asset'), 'utf8')).toBe('a');
    expect(fs.existsSync(source)).toBe(false);
  });

  // Root ignores directory permissions, and Windows does not use them to guard deletion.
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'never leaves a half-deleted source when a child cannot be removed after the copy',
    () => {
      fs.mkdirSync(path.join(source, 'locked'));
      fs.writeFileSync(path.join(source, 'locked', 'c.asset'), 'c');
      fs.chmodSync(path.join(source, 'locked'), 0o555);
      refuseFirstRename('EXDEV');

      try {
        const move = moveDirectory(source, destination);

        expect(move).toMatchObject({ method: 'copy', sourceCleanupError: expect.any(String) });
        expect(fs.existsSync(source)).toBe(false);
        expect(fs.readFileSync(path.join(destination, 'locked', 'c.asset'), 'utf8')).toBe('c');
      } finally {
        makeWritable(root);
      }
    },
  );

  it('keeps the source whole when it cannot be set aside after a complete copy', () => {
    const realRename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (from === source) throw renameError(to === destination ? 'EXDEV' : 'EBUSY');
      realRename(from, to);
    });

    const move = moveDirectory(source, destination);

    expect(move).toMatchObject({
      method: 'copy',
      sourceCleanupError: expect.stringContaining(`kept ${source} whole`),
    });
    expect(fs.readFileSync(path.join(source, 'nested', 'b.asset'), 'utf8')).toBe('b');
    expect(fs.readFileSync(path.join(destination, 'nested', 'b.asset'), 'utf8')).toBe('b');
  });

  it('rethrows rename failures a copy cannot fix', () => {
    refuseFirstRename('ENOENT');

    expect(() => moveDirectory(source, destination)).toThrow('ENOENT');
    expect(fs.existsSync(destination)).toBe(false);
  });

  it('keeps relative symlinks working after a copy fallback removes the source', () => {
    fs.symlinkSync('a.asset', path.join(source, 'link.asset'));
    refuseFirstRename('EXDEV');

    moveDirectory(source, destination);

    expect(fs.readlinkSync(path.join(destination, 'link.asset'))).toBe('a.asset');
    expect(fs.readFileSync(path.join(destination, 'link.asset'), 'utf8')).toBe('a');
  });
});

describe('copyIntoPlace', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-into-place-'));
    fs.mkdirSync(path.join(root, 'from', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(root, 'from', 'nested', 'b.asset'), 'b');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('copies a directory and keeps the source', () => {
    copyIntoPlace(path.join(root, 'from'), path.join(root, 'to'));

    expect(fs.readFileSync(path.join(root, 'to', 'nested', 'b.asset'), 'utf8')).toBe('b');
    expect(fs.existsSync(path.join(root, 'from', 'nested', 'b.asset'))).toBe(true);
    expect(fs.readdirSync(root).sort()).toEqual(['from', 'to']);
  });

  it('leaves no destination and no staging directory when the copy fails', () => {
    vi.spyOn(fs, 'cpSync').mockImplementation((_from, to) => {
      fs.mkdirSync(String(to));
      throw new Error('ENOSPC: no space left on device');
    });

    expect(() => copyIntoPlace(path.join(root, 'from'), path.join(root, 'to'))).toThrow('ENOSPC');
    expect(fs.readdirSync(root)).toEqual(['from']);
  });
});

describe('removeDirectory', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-directory-'));
    fs.mkdirSync(path.join(root, 'Library', 'nested'), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('removes the directory and its tombstone', () => {
    expect(removeDirectory(path.join(root, 'Library'))).toEqual({ outcome: 'removed' });
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('keeps the directory whole when it cannot be set aside', () => {
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw renameError('EBUSY');
    });

    expect(removeDirectory(path.join(root, 'Library'))).toEqual({
      outcome: 'kept-whole',
      error: 'EBUSY: rename refused',
    });
    expect(fs.existsSync(path.join(root, 'Library', 'nested'))).toBe(true);
  });

  it('reports the tombstone it could not delete, with the directory already gone', () => {
    vi.spyOn(fs, 'rmSync').mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    const removal = removeDirectory(path.join(root, 'Library'));

    expect(removal).toEqual({
      outcome: 'tombstone-left',
      tombstone: expect.stringContaining(path.join(root, `.Library.removing-${process.pid}-`)),
      error: 'EACCES: permission denied',
    });
    expect(fs.readdirSync(root)).toEqual([
      path.basename((removal as { tombstone: string }).tombstone),
    ]);
  });
});

describe('sweepAbandonedLeftovers', () => {
  let root: string;
  let deadPid: number;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-leftovers-'));
    deadPid = 999_999_999;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports a leftover it cannot remove and keeps sweeping the others', () => {
    const stuck = path.join(root, `.Library.removing-${deadPid}-a`);
    const removable = path.join(root, `.Library.partial-${deadPid}-b`);
    fs.mkdirSync(stuck);
    fs.mkdirSync(removable);
    const realRm = fs.rmSync;
    vi.spyOn(fs, 'rmSync').mockImplementation((target, options) => {
      if (target === stuck) throw new Error('EACCES: permission denied');
      realRm(target, options);
    });

    expect(sweepAbandonedLeftovers(root)).toEqual({
      removed: [removable],
      failed: [{ path: stuck, error: 'EACCES: permission denied' }],
    });
    expect(fs.readdirSync(root)).toEqual([path.basename(stuck)]);
  });

  it('removes staging and tombstone directories of processes that are gone', () => {
    fs.mkdirSync(path.join(root, `.Library.partial-${deadPid}-abc`, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(root, `.Library.removing-${deadPid}-abc`));

    const { removed, failed } = sweepAbandonedLeftovers(root);

    expect(failed).toEqual([]);
    expect(removed.map((leftover) => path.basename(leftover)).sort()).toEqual([
      `.Library.partial-${deadPid}-abc`,
      `.Library.removing-${deadPid}-abc`,
    ]);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('keeps leftovers of a live process, cache entries and look-alike files', () => {
    const kept = [
      `.Library.partial-${process.pid}-abc`,
      `.Library.removing-${process.ppid}-abc`,
      'Library',
      '.Library.partial-notapid-abc',
    ];
    for (const name of kept) fs.mkdirSync(path.join(root, name));
    fs.writeFileSync(path.join(root, `.Library.partial-${deadPid}-file`), '');

    expect(sweepAbandonedLeftovers(root)).toEqual({ removed: [], failed: [] });
    expect(fs.readdirSync(root).sort()).toEqual(
      [...kept, `.Library.partial-${deadPid}-file`].sort(),
    );
  });
});
