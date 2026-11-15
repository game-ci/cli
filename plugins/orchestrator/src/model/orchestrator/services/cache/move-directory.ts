import fs from 'node:fs';
import path from 'node:path';

/** Rename failures that a copy can work around: another volume, or a rename the OS refuses. */
const copyableRenameErrors = new Set(['EXDEV', 'EPERM']);

/** Sibling directories this module leaves behind only when a process dies mid-operation. */
const leftoverPattern = /^\..+\.(partial|removing)-(\d+)-[\da-z]+$/;

export type DirectoryMove =
  | { method: 'rename' }
  | {
      method: 'copy';
      /** Why the rename was refused (EXDEV or EPERM). */
      renameError: string;
      /** Set when the copy is complete but the source could not be removed afterwards. */
      sourceCleanupError?: string;
    };

export type DirectoryRemoval =
  | { outcome: 'removed' }
  /** The directory could not be set aside, so it was left in place, whole. */
  | { outcome: 'kept-whole'; error: string }
  /** The directory is gone, but its tombstone could not be deleted fully. */
  | { outcome: 'tombstone-left'; tombstone: string; error: string };

/**
 * Moves a directory with an atomic rename, falling back to a copy when the
 * rename crosses filesystems (EXDEV) or is refused (EPERM), for instance a
 * cache root configured on another volume than the workspace.
 *
 * The copy is staged in a sibling directory and renamed into place only once
 * complete, so a failed copy never leaves a partial destination behind for a
 * later restore to mistake for a valid cache. The source is then removed with
 * removeDirectory, so a failed removal never leaves it half-deleted either.
 */
export function moveDirectory(source: string, destination: string): DirectoryMove {
  try {
    fs.renameSync(source, destination);
    return { method: 'rename' };
  } catch (error: unknown) {
    const renameError = errorCode(error);
    if (!renameError || !copyableRenameErrors.has(renameError)) throw error;

    copyIntoPlace(source, destination);

    const removal = removeDirectory(source);
    switch (removal.outcome) {
      case 'removed':
        return { method: 'copy', renameError };
      case 'kept-whole':
        return {
          method: 'copy',
          renameError,
          sourceCleanupError: `${removal.error}; kept ${source} whole`,
        };
      case 'tombstone-left':
        return {
          method: 'copy',
          renameError,
          sourceCleanupError: `${removal.error}; left ${removal.tombstone} for a later sweep`,
        };
    }
  }
}

/**
 * Copies a directory to a destination that does not exist yet. The copy is
 * staged in a sibling `.<name>.partial-<pid>-<ts>` directory and renamed into
 * place only once complete; on failure the staging directory is removed and
 * the error rethrown, so the destination is either whole or absent.
 */
export function copyIntoPlace(source: string, destination: string): void {
  const staging = siblingPath(destination, 'partial');

  try {
    // verbatimSymlinks keeps relative links relative; resolved, they would point into the removed source.
    fs.cpSync(source, staging, { recursive: true, verbatimSymlinks: true });
    fs.renameSync(staging, destination);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Removes a directory so that it is either whole or gone, never half-deleted:
 * it is first renamed to a sibling `.<name>.removing-<pid>-<ts>` tombstone
 * (same volume, atomic), and only the tombstone is deleted.
 */
export function removeDirectory(directory: string): DirectoryRemoval {
  const tombstone = siblingPath(directory, 'removing');

  try {
    fs.renameSync(directory, tombstone);
  } catch (error: unknown) {
    return { outcome: 'kept-whole', error: describe(error) };
  }

  try {
    fs.rmSync(tombstone, { recursive: true, force: true });
    return { outcome: 'removed' };
  } catch (error: unknown) {
    return { outcome: 'tombstone-left', tombstone, error: describe(error) };
  }
}

export type LeftoverSweep = {
  removed: string[];
  failed: { path: string; error: string }[];
};

/**
 * Deletes the staging and tombstone directories under `parent` whose owning
 * process is gone, e.g. after a runner was killed mid-copy. Directories of a
 * process that is still alive, or that cannot be checked, are kept. A leftover
 * that cannot be removed is reported and the sweep moves on to the next one;
 * this throws only if `parent` cannot be read.
 */
export function sweepAbandonedLeftovers(parent: string): LeftoverSweep {
  const sweep: LeftoverSweep = { removed: [], failed: [] };

  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    const match = entry.isDirectory() && leftoverPattern.exec(entry.name);
    if (!match || isProcessAlive(Number(match[2]))) continue;

    const leftover = path.join(parent, entry.name);
    try {
      fs.rmSync(leftover, { recursive: true, force: true });
      sweep.removed.push(leftover);
    } catch (error: unknown) {
      sweep.failed.push({ path: leftover, error: describe(error) });
    }
  }

  return sweep;
}

function siblingPath(directory: string, purpose: 'partial' | 'removing'): string {
  return path.join(
    path.dirname(directory),
    `.${path.basename(directory)}.${purpose}-${process.pid}-${Date.now().toString(36)}`,
  );
}

function isProcessAlive(pid: number): boolean {
  if (pid === process.pid) return true;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    // EPERM means the process exists under another user; only ESRCH proves it is gone.
    return errorCode(error) !== 'ESRCH';
  }
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException)?.code;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
