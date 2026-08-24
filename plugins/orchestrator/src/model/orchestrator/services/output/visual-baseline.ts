import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Visual-regression comparison for the `images` / `visual-baseline` output
 * types.
 *
 * Capture collection itself is already an output concern - the `images`
 * built-in type ("Screenshots, render captures, atlas previews") predates
 * this module. What was missing is the *comparison*: deciding whether this
 * run's captures differ from the accepted reference set.
 *
 * Scope, deliberately: this compares by content digest, which answers
 * "did this frame change at all?" exactly, with no image decoding and no
 * native dependency. It does NOT do perceptual/threshold diffing - a
 * one-pixel antialiasing change and a completely different frame both read
 * as "changed". Perceptual diffing needs a real image codec and a tuned
 * threshold; adding one is a separate decision, and pretending to do it
 * with a byte hash would be worse than not offering it.
 */

export type VisualChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface VisualComparisonEntry {
  /** Capture path relative to its directory root. */
  name: string;
  kind: VisualChangeKind;
  baselineDigest?: string;
  currentDigest?: string;
}

export interface VisualComparisonResult {
  entries: VisualComparisonEntry[];
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  /** True when nothing differs from the baseline. */
  matchesBaseline: boolean;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.tga', '.webp']);

export interface DigestDirectoryOptions {
  fsImpl?: Pick<typeof fs, 'existsSync' | 'readdirSync' | 'readFileSync'>;
}

/**
 * Maps every image under `root` to a content digest, keyed by its path
 * relative to `root`. Missing directories yield an empty map rather than
 * throwing - a first-ever run legitimately has no baseline yet.
 */
export function digestDirectory(
  root: string,
  options: DigestDirectoryOptions = {},
): Map<string, string> {
  const fsImpl = options.fsImpl ?? fs;
  const digests = new Map<string, string>();

  if (!fsImpl.existsSync(root)) return digests;

  const walk = (directory: string): void => {
    for (const entry of fsImpl.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

      const contents = fsImpl.readFileSync(full);
      const digest = crypto.createHash('sha256').update(contents).digest('hex');
      // Normalize to forward slashes so a baseline captured on Linux still
      // matches the same capture produced on a Windows runner.
      digests.set(path.relative(root, full).split(path.sep).join('/'), digest);
    }
  };

  walk(root);

  return digests;
}

/**
 * Compares this run's captures against the accepted baseline.
 *
 * An empty baseline is reported as every capture being 'added' (and so
 * `matchesBaseline: false`) rather than as a pass - a run with no reference
 * to compare against has not been verified, and silently passing it would
 * make the whole check vacuous on the first run and after any accidental
 * baseline deletion.
 */
export function compareVisualCaptures(
  baseline: Map<string, string>,
  current: Map<string, string>,
): VisualComparisonResult {
  const entries: VisualComparisonEntry[] = [];
  const names = new Set<string>([...baseline.keys(), ...current.keys()]);

  for (const name of [...names].sort()) {
    const baselineDigest = baseline.get(name);
    const currentDigest = current.get(name);

    let kind: VisualChangeKind;
    if (baselineDigest === undefined) kind = 'added';
    else if (currentDigest === undefined) kind = 'removed';
    else if (baselineDigest !== currentDigest) kind = 'changed';
    else kind = 'unchanged';

    entries.push({ name, kind, baselineDigest, currentDigest });
  }

  const count = (kind: VisualChangeKind) => entries.filter((entry) => entry.kind === kind).length;
  const added = count('added');
  const removed = count('removed');
  const changed = count('changed');

  return {
    entries,
    added,
    removed,
    changed,
    unchanged: count('unchanged'),
    matchesBaseline: added === 0 && removed === 0 && changed === 0,
  };
}

/** Human-readable one-line summary, for the build log. */
export function summarizeVisualComparison(result: VisualComparisonResult): string {
  if (result.entries.length === 0) return 'No visual captures found to compare.';
  if (result.matchesBaseline) return `All ${result.unchanged} capture(s) match the baseline.`;

  return (
    `Visual differences: ${result.changed} changed, ${result.added} added, ` +
    `${result.removed} removed, ${result.unchanged} unchanged.`
  );
}
