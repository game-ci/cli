import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveDirectory } from './move-directory';

function renameError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: rename refused`), { code });
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

    expect(moveDirectory(source, destination)).toEqual({
      method: 'copy',
      renameError: 'EXDEV',
      sourceCleanupError: 'EBUSY: resource busy',
    });
    expect(fs.readFileSync(path.join(destination, 'a.asset'), 'utf8')).toBe('a');
  });

  it('rethrows rename failures a copy cannot fix', () => {
    refuseFirstRename('ENOENT');

    expect(() => moveDirectory(source, destination)).toThrow('ENOENT');
    expect(fs.existsSync(destination)).toBe(false);
  });
});
