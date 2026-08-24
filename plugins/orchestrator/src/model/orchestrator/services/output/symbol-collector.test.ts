import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { collectSymbols, summarizeSymbols } from './symbol-collector';

/**
 * Builds a fake fs over a { path: sizeOrDirectory } tree, so these tests
 * exercise the real traversal logic without touching disk. Directories are
 * represented by a trailing '/'.
 */
function fakeFs(tree: Record<string, number>) {
  const files = Object.keys(tree);
  const isDirectory = (target: string) =>
    files.some((file) => file !== target && file.startsWith(`${target}${path.sep}`));

  return {
    existsSync: (target: string) =>
      files.some((file) => file === target || file.startsWith(`${target}${path.sep}`)),
    statSync: ((target: string) => ({ size: tree[target] ?? 0 })) as any,
    readdirSync: ((directory: string) => {
      const prefix = `${directory}${path.sep}`;
      const names = new Set<string>();
      for (const file of files) {
        if (!file.startsWith(prefix)) continue;
        names.add(file.slice(prefix.length).split(path.sep)[0]);
      }

      return [...names].map((name) => ({
        name,
        isDirectory: () => isDirectory(path.join(directory, name)),
      }));
    }) as any,
  };
}

const ROOT = path.join('build', 'out');
const p = (...parts: string[]) => path.join(ROOT, ...parts);

describe('collectSymbols', () => {
  it('returns an empty array when the directory does not exist', () => {
    expect(collectSymbols({ rootPath: ROOT, fsImpl: fakeFs({}) })).toEqual([]);
  });

  it('finds PDB, Breakpad and DWARF symbol files', () => {
    const symbols = collectSymbols({
      rootPath: ROOT,
      fsImpl: fakeFs({
        [p('Game.pdb')]: 2048,
        [p('Game.sym')]: 512,
        [p('libmain.so.dbg')]: 4096,
        [p('Game.exe')]: 999999,
      }),
    });

    expect(symbols.map((s) => [s.relativePath, s.format])).toEqual([
      ['Game.pdb', 'PDB'],
      ['Game.sym', 'Breakpad'],
      ['libmain.so.dbg', 'DWARF'],
    ]);
  });

  it('prefers the longer extension so .so.dbg is not read as a bare .dbg', () => {
    const symbols = collectSymbols({
      rootPath: ROOT,
      fsImpl: fakeFs({ [p('libmain.so.dbg')]: 10 }),
    });

    expect(symbols[0].format).toBe('DWARF');
  });

  it('treats a .dSYM as one bundle entry and does not descend into it', () => {
    const symbols = collectSymbols({
      rootPath: ROOT,
      fsImpl: fakeFs({
        [p('Game.dSYM', 'Contents', 'Resources', 'DWARF', 'Game')]: 3000,
        [p('Game.dSYM', 'Contents', 'Info.plist')]: 100,
      }),
    });

    // One entry, not one per file inside - the symbolicator needs the
    // bundle intact, and per-file entries would lose that structure.
    expect(symbols).toHaveLength(1);
    expect(symbols[0].isBundle).toBe(true);
    expect(symbols[0].format).toBe('dSYM');
    expect(symbols[0].sizeBytes).toBe(3100);
  });

  it('finds symbols nested in subdirectories', () => {
    const symbols = collectSymbols({
      rootPath: ROOT,
      fsImpl: fakeFs({ [p('nested', 'deep', 'Game.pdb')]: 1 }),
    });

    expect(symbols).toHaveLength(1);
    expect(symbols[0].relativePath).toBe(path.join('nested', 'deep', 'Game.pdb'));
  });

  it('returns entries in a stable order regardless of readdir order', () => {
    const symbols = collectSymbols({
      rootPath: ROOT,
      fsImpl: fakeFs({ [p('z.pdb')]: 1, [p('a.pdb')]: 1, [p('m.pdb')]: 1 }),
    });

    expect(symbols.map((s) => s.relativePath)).toEqual(['a.pdb', 'm.pdb', 'z.pdb']);
  });
});

describe('summarizeSymbols', () => {
  it('reports the no-symbols case explicitly', () => {
    expect(summarizeSymbols([])).toMatch(/no debug symbols/i);
  });

  it('counts by format and totals the size', () => {
    const summary = summarizeSymbols([
      { path: 'a', relativePath: 'a', format: 'PDB', sizeBytes: 1024 * 1024, isBundle: false },
      { path: 'b', relativePath: 'b', format: 'PDB', sizeBytes: 1024 * 1024, isBundle: false },
      { path: 'c', relativePath: 'c', format: 'dSYM', sizeBytes: 0, isBundle: true },
    ]);

    expect(summary).toContain('3 symbol artifact(s)');
    expect(summary).toContain('2 PDB');
    expect(summary).toContain('1 dSYM');
    expect(summary).toContain('2.00 MB');
  });
});
