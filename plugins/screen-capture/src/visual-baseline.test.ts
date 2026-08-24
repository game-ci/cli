import { describe, it, expect } from 'vitest';
import {
  compareVisualCaptures,
  summarizeVisualComparison,
  digestDirectory,
} from './visual-baseline';
import path from 'node:path';

const digests = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('compareVisualCaptures', () => {
  it('reports an identical set as matching', () => {
    const result = compareVisualCaptures(
      digests({ 'menu.png': 'aaa' }),
      digests({ 'menu.png': 'aaa' }),
    );

    expect(result.matchesBaseline).toBe(true);
    expect(result.unchanged).toBe(1);
  });

  it('detects a changed capture', () => {
    const result = compareVisualCaptures(
      digests({ 'menu.png': 'aaa' }),
      digests({ 'menu.png': 'bbb' }),
    );

    expect(result.matchesBaseline).toBe(false);
    expect(result.changed).toBe(1);
    expect(result.entries[0]).toMatchObject({ name: 'menu.png', kind: 'changed' });
  });

  it('detects added and removed captures', () => {
    const result = compareVisualCaptures(
      digests({ 'gone.png': 'aaa' }),
      digests({ 'new.png': 'bbb' }),
    );

    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.matchesBaseline).toBe(false);
  });

  it('treats an empty baseline as unverified rather than as a pass', () => {
    const result = compareVisualCaptures(new Map(), digests({ 'menu.png': 'aaa' }));

    // Silently passing here would make the check vacuous on a first run
    // and after an accidental baseline deletion.
    expect(result.matchesBaseline).toBe(false);
    expect(result.added).toBe(1);
  });

  it('reports nothing to compare when both sides are empty', () => {
    const result = compareVisualCaptures(new Map(), new Map());

    expect(result.entries).toEqual([]);
    expect(result.matchesBaseline).toBe(true);
    expect(summarizeVisualComparison(result)).toMatch(/no visual captures/i);
  });

  it('orders entries by name for a stable, diffable report', () => {
    const result = compareVisualCaptures(
      digests({ 'z.png': 'a', 'a.png': 'a' }),
      digests({ 'z.png': 'a', 'a.png': 'a' }),
    );

    expect(result.entries.map((entry) => entry.name)).toEqual(['a.png', 'z.png']);
  });
});

describe('digestDirectory', () => {
  const fakeFs = (files: Record<string, string>) => ({
    existsSync: (target: string) =>
      Object.keys(files).some((file) => file === target || file.startsWith(`${target}${path.sep}`)),
    readdirSync: ((directory: string) => {
      const prefix = `${directory}${path.sep}`;
      const names = new Set<string>();
      for (const file of Object.keys(files)) {
        if (!file.startsWith(prefix)) continue;
        names.add(file.slice(prefix.length).split(path.sep)[0]);
      }

      return [...names].map((name) => ({
        name,
        isDirectory: () =>
          Object.keys(files).some((file) =>
            file.startsWith(`${path.join(directory, name)}${path.sep}`),
          ),
      }));
    }) as any,
    readFileSync: ((target: string) => Buffer.from(files[target] ?? '')) as any,
  });

  it('returns an empty map for a directory that does not exist', () => {
    expect(digestDirectory('nope', { fsImpl: fakeFs({}) }).size).toBe(0);
  });

  it('digests images and ignores non-image files', () => {
    const result = digestDirectory('caps', {
      fsImpl: fakeFs({
        [path.join('caps', 'menu.png')]: 'pixels',
        [path.join('caps', 'notes.txt')]: 'ignore me',
      }),
    });

    expect([...result.keys()]).toEqual(['menu.png']);
  });

  it('gives identical content the same digest and different content a different one', () => {
    const a = digestDirectory('caps', { fsImpl: fakeFs({ [path.join('caps', 'x.png')]: 'same' }) });
    const b = digestDirectory('caps', { fsImpl: fakeFs({ [path.join('caps', 'x.png')]: 'same' }) });
    const c = digestDirectory('caps', {
      fsImpl: fakeFs({ [path.join('caps', 'x.png')]: 'different' }),
    });

    expect(a.get('x.png')).toBe(b.get('x.png'));
    expect(a.get('x.png')).not.toBe(c.get('x.png'));
  });

  it('normalizes nested keys to forward slashes so baselines are portable across OSes', () => {
    const result = digestDirectory('caps', {
      fsImpl: fakeFs({ [path.join('caps', 'hud', 'health.png')]: 'pixels' }),
    });

    // A baseline captured on Linux must still match the same capture
    // produced on a Windows runner.
    expect([...result.keys()]).toEqual(['hud/health.png']);
  });
});
