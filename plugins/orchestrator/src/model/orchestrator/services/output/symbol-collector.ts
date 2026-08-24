import fs from 'node:fs';
import path from 'node:path';

/**
 * Debug-symbol discovery for the `symbols` output type.
 *
 * Crash reporters (Sentry, Backtrace, Crashlytics, ...) symbolicate stack
 * traces from a build's debug symbols, which have to be captured at build
 * time - once the build machine is gone the symbols are unrecoverable and
 * every future crash report from that build stays unreadable. That makes
 * this an output-collection concern, exactly like coverage/, logs/ and
 * metrics/ already are, rather than a separate user-facing command.
 *
 * This module only *finds and classifies* symbol files. Uploading them is
 * left to ArtifactUploadHandler, which already knows how to push an
 * OutputEntry to github-artifacts/storage/local - there is deliberately no
 * vendor-specific upload path here.
 */

export type SymbolFormat = 'dSYM' | 'PDB' | 'Breakpad' | 'DWARF' | 'IL2CPP-map';

export interface SymbolFile {
  /** Absolute path to the symbol file or bundle directory. */
  path: string;
  /** Path relative to the search root, for manifest entries. */
  relativePath: string;
  /** Which debugger/crash-reporter format this is. */
  format: SymbolFormat;
  /** Total size in bytes (recursive for bundle directories such as .dSYM). */
  sizeBytes: number;
  /** True when this entry is a directory bundle rather than a single file. */
  isBundle: boolean;
}

/**
 * Extension -> format. Ordered longest-first at match time so that
 * ".so.dbg" wins over ".dbg".
 */
const FILE_FORMATS: ReadonlyArray<readonly [string, SymbolFormat]> = [
  ['.so.dbg', 'DWARF'],
  ['.sym', 'Breakpad'],
  ['.pdb', 'PDB'],
  ['.dbg', 'DWARF'],
  // Unity/IL2CPP emits these next to the player; without them an IL2CPP
  // release stack trace cannot be mapped back to managed method names.
  ['.symbols.json', 'IL2CPP-map'],
];

function formatForFile(fileName: string): SymbolFormat | null {
  const lower = fileName.toLowerCase();
  for (const [extension, format] of FILE_FORMATS) {
    if (lower.endsWith(extension)) return format;
  }

  return null;
}

function directorySize(
  directory: string,
  statSync: typeof fs.statSync,
  readdirSync: typeof fs.readdirSync,
): number {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      total += directorySize(full, statSync, readdirSync);
    } else {
      total += statSync(full).size;
    }
  }

  return total;
}

export interface CollectSymbolsOptions {
  /** Directory to search, typically the build output path. */
  rootPath: string;
  /** Injected for testing; defaults to the real fs. */
  fsImpl?: Pick<typeof fs, 'existsSync' | 'readdirSync' | 'statSync'>;
}

/**
 * Recursively finds debug symbols under `rootPath`.
 *
 * A `.dSYM` is a *directory* bundle, not a file, so it is reported as a
 * single entry (with its recursive size) and not descended into - otherwise
 * every DWARF file inside it would be reported separately and the upload
 * would lose the bundle structure the symbolicator expects.
 *
 * Returns an empty array when the root does not exist: a build that
 * produced no symbols is normal (debug symbols are commonly off for
 * release), not an error.
 */
export function collectSymbols(options: CollectSymbolsOptions): SymbolFile[] {
  const { rootPath } = options;
  const fsImpl = options.fsImpl ?? fs;

  if (!fsImpl.existsSync(rootPath)) return [];

  const found: SymbolFile[] = [];

  const walk = (directory: string): void => {
    for (const entry of fsImpl.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.toLowerCase().endsWith('.dsym')) {
          found.push({
            path: full,
            relativePath: path.relative(rootPath, full),
            format: 'dSYM',
            sizeBytes: directorySize(
              full,
              fsImpl.statSync as typeof fs.statSync,
              fsImpl.readdirSync as typeof fs.readdirSync,
            ),
            isBundle: true,
          });
          continue;
        }

        walk(full);
        continue;
      }

      const format = formatForFile(entry.name);
      if (!format) continue;

      found.push({
        path: full,
        relativePath: path.relative(rootPath, full),
        format,
        sizeBytes: fsImpl.statSync(full).size,
        isBundle: false,
      });
    }
  };

  walk(rootPath);

  // Stable ordering keeps manifests diffable between runs; readdir order is
  // filesystem-dependent and not guaranteed.
  return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/** Human-readable one-line summary, for the build log. */
export function summarizeSymbols(symbols: SymbolFile[]): string {
  if (symbols.length === 0) return 'No debug symbols found.';

  const byFormat = new Map<SymbolFormat, number>();
  let totalBytes = 0;
  for (const symbol of symbols) {
    byFormat.set(symbol.format, (byFormat.get(symbol.format) ?? 0) + 1);
    totalBytes += symbol.sizeBytes;
  }

  const parts = [...byFormat.entries()].map(([format, count]) => `${count} ${format}`).sort();

  return `Found ${symbols.length} symbol artifact(s) (${parts.join(', ')}), ${(totalBytes / 1024 / 1024).toFixed(2)} MB total.`;
}
