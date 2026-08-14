import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CacheSummary {
  entries: string[];
  totalSize: number;
}

/**
 * Portable, host-OS-agnostic equivalent of `ls <dir>` plus `du -sh <dir>`
 * for the local-docker provider's cache-inspection logging. Returns the
 * top-level entry names (matching `ls` non-recursive behaviour) plus the
 * recursive total size in bytes (matching `du -sh`'s aggregate behaviour).
 *
 * Why this exists: the previous implementation shelled out to the host
 * via `child_process.exec('ls ... && du -sh ...')`, which only works on
 * POSIX hosts (Linux/macOS). On Windows runners (cmd.exe), `ls`, `du`,
 * and `&&` chaining all fail, aborting the orchestrator before any
 * container starts. Replacing the shell-out with Node `fs` operations
 * makes the cache inspection portable to every Node-supported OS without
 * requiring an external shell or POSIX userland (e.g. Git Bash).
 *
 * Returns an empty summary (`{ entries: [], totalSize: 0 }`) if the
 * directory does not exist -- callers should still gate on `existsSync`
 * if they want to distinguish absent from empty.
 */
export function summariseCacheDirectory(directory: string): CacheSummary {
  if (!fs.existsSync(directory)) {
    return { entries: [], totalSize: 0 };
  }

  const entries = fs.readdirSync(directory);
  let totalSize = 0;

  for (const entry of entries) {
    totalSize += walkSize(path.join(directory, entry));
  }

  return { entries, totalSize };
}

/**
 * Recursive byte-size sum for a single path. Mirrors `du`'s default
 * behaviour of following the directory tree, summing regular-file sizes,
 * and tolerating broken/inaccessible entries (returns 0 for the offending
 * branch rather than throwing). Symbolic links contribute the size of the
 * link target's stat -- consistent with `du` without `-L`.
 */
function walkSize(target: string): number {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(target);
  } catch {
    return 0;
  }

  if (stat.isFile()) {
    return stat.size;
  }

  if (!stat.isDirectory()) {
    return 0;
  }

  let total = 0;
  let children: string[];
  try {
    children = fs.readdirSync(target);
  } catch {
    return 0;
  }

  for (const child of children) {
    total += walkSize(path.join(target, child));
  }
  return total;
}

/**
 * Format a byte count for human-readable logging in the same shape as
 * `du -sh` (powers of 1024, single suffix, one decimal place above the
 * KiB boundary). Pure formatting helper -- no I/O.
 */
export function formatHumanReadableSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  const units = ['K', 'M', 'G', 'T'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  // One decimal place when value < 10 for finer granularity at small
  // human-readable magnitudes; integer otherwise. Matches `du -sh`'s
  // typical output style on common GNU coreutils.
  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return `${formatted}${units[unitIndex]}`;
}
