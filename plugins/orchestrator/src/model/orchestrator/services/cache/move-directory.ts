import fs from 'node:fs';
import path from 'node:path';

/** Rename failures that a copy can work around: another volume, or a rename the OS refuses. */
const copyableRenameErrors = new Set(['EXDEV', 'EPERM']);

export type DirectoryMove =
  | { method: 'rename' }
  | {
      method: 'copy';
      /** Why the rename was refused (EXDEV or EPERM). */
      renameError: string;
      /** Set when the copy is complete but the source could not be removed afterwards. */
      sourceCleanupError?: string;
    };

/**
 * Moves a directory with an atomic rename, falling back to a copy when the
 * rename crosses filesystems (EXDEV) or is refused (EPERM), for instance a
 * cache root configured on another volume than the workspace.
 *
 * The copy is staged in a sibling directory and renamed into place only once
 * complete, so a failed copy never leaves a partial destination behind for a
 * later restore to mistake for a valid cache. The source is removed only after
 * the destination is in place.
 */
export function moveDirectory(source: string, destination: string): DirectoryMove {
  try {
    fs.renameSync(source, destination);
    return { method: 'rename' };
  } catch (error: any) {
    if (!copyableRenameErrors.has(error?.code)) throw error;

    copyIntoPlace(source, destination);

    try {
      fs.rmSync(source, { recursive: true, force: true });
      return { method: 'copy', renameError: error.code };
    } catch (cleanupError: any) {
      return {
        method: 'copy',
        renameError: error.code,
        sourceCleanupError: cleanupError?.message ?? String(cleanupError),
      };
    }
  }
}

function copyIntoPlace(source: string, destination: string): void {
  const staging = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.partial-${process.pid}-${Date.now().toString(36)}`,
  );

  try {
    fs.cpSync(source, staging, { recursive: true });
    fs.renameSync(staging, destination);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}
