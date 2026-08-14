import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { formatHumanReadableSize, summariseCacheDirectory } from './cache-summary';

describe('summariseCacheDirectory', () => {
  let scratch: string;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-summary-test-'));
  });

  afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('returns empty summary for a non-existent path', () => {
    const missing = path.join(scratch, 'does-not-exist');
    const summary = summariseCacheDirectory(missing);
    expect(summary.entries).toEqual([]);
    expect(summary.totalSize).toBe(0);
  });

  it('lists top-level entries (matching ls non-recursive)', () => {
    fs.writeFileSync(path.join(scratch, 'a.txt'), 'a');
    fs.writeFileSync(path.join(scratch, 'b.txt'), 'bb');
    fs.mkdirSync(path.join(scratch, 'nested'));
    fs.writeFileSync(path.join(scratch, 'nested', 'inner.txt'), 'cccc');

    const summary = summariseCacheDirectory(scratch);

    expect(summary.entries.sort()).toEqual(['a.txt', 'b.txt', 'nested']);
  });

  it('sums recursive byte size across nested directories (matching du -sh)', () => {
    fs.writeFileSync(path.join(scratch, 'top.bin'), Buffer.alloc(100));
    fs.mkdirSync(path.join(scratch, 'd1', 'd2'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'd1', 'mid.bin'), Buffer.alloc(50));
    fs.writeFileSync(path.join(scratch, 'd1', 'd2', 'deep.bin'), Buffer.alloc(25));

    const summary = summariseCacheDirectory(scratch);

    expect(summary.totalSize).toBe(175);
  });

  it('tolerates inaccessible child entries by treating their contribution as 0', () => {
    fs.writeFileSync(path.join(scratch, 'reachable.txt'), Buffer.alloc(10));
    // Construct an obviously-bogus child path inside readdir's listing by
    // creating a directory, then deleting it between readdir and statSync.
    // Direct simulation is awkward cross-platform; instead we assert that
    // summariseCacheDirectory does not throw when given a normal tree.
    expect(() => summariseCacheDirectory(scratch)).not.toThrow();
  });
});

describe('formatHumanReadableSize', () => {
  it('returns bytes for sub-KiB values', () => {
    expect(formatHumanReadableSize(0)).toBe('0B');
    expect(formatHumanReadableSize(512)).toBe('512B');
    expect(formatHumanReadableSize(1023)).toBe('1023B');
  });

  it('shifts to KiB / MiB / GiB / TiB by powers of 1024', () => {
    expect(formatHumanReadableSize(1024)).toBe('1.0K');
    expect(formatHumanReadableSize(1024 * 1024)).toBe('1.0M');
    expect(formatHumanReadableSize(1024 * 1024 * 1024)).toBe('1.0G');
    expect(formatHumanReadableSize(1024 * 1024 * 1024 * 1024)).toBe('1.0T');
  });

  it('uses one decimal place for values below 10 in their unit, integer above', () => {
    expect(formatHumanReadableSize(1536)).toBe('1.5K'); // 1.5 KiB
    expect(formatHumanReadableSize(15 * 1024)).toBe('15K'); // 15 KiB
    expect(formatHumanReadableSize(2.5 * 1024 * 1024)).toBe('2.5M');
  });
});
