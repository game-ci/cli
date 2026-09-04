import { gunzipSync } from 'node:zlib';
import { fsSync as fs, path, process } from '../dependencies.ts';
import {
  EMBEDDED_ASSETS_GZIP_BASE64,
  EMBEDDED_ASSETS_HASH,
  EMBEDDED_ASSETS_INDEX,
  EMBEDDED_ASSETS_SIZE,
} from '../generated/embedded-assets.ts';

/**
 * The compiled binary cannot mount its own assets into Docker: `bun
 * --compile` exposes bundled files through a virtual filesystem
 * ("/$bunfs/..." on Linux/macOS, "B:\~BUN\..." on Windows) that has no real
 * path for Docker to bind-mount. So the embedded blob is written out to a
 * real directory once, and that directory is what gets mounted.
 *
 * The cache is keyed by a hash of the payload rather than by release version:
 * a binary upgraded in place must never reuse the previous version's assets,
 * and two binaries carrying identical assets should share one extraction.
 */
export class EmbeddedAssets {
  /** Escape hatch: point at a real dist/ to debug or patch assets in place. */
  static readonly overrideEnvVar = 'GAME_CI_DIST_PATH';

  static cacheRoot(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';

    return path.join(home, '.game-ci', 'assets');
  }

  static targetDir(): string {
    return path.join(EmbeddedAssets.cacheRoot(), EMBEDDED_ASSETS_HASH);
  }

  /**
   * Written only after every file is in place, so an extraction killed
   * part-way through is never mistaken for a complete one on the next run.
   */
  private static markerPath(dir: string): string {
    return path.join(dir, '.complete');
  }

  private static decode(): Buffer {
    const blob = gunzipSync(Buffer.from(EMBEDDED_ASSETS_GZIP_BASE64, 'base64'));

    if (blob.length !== EMBEDDED_ASSETS_SIZE) {
      throw new Error(
        `Embedded assets are corrupt: expected ${EMBEDDED_ASSETS_SIZE} bytes, decompressed ${blob.length}.`,
      );
    }

    return blob;
  }

  /**
   * Extracts into a sibling temp directory and renames it into place, so a
   * concurrent run either sees no directory at all or a complete one - never
   * a half-written tree. Two jobs racing is expected (parallel matrix builds
   * share a home directory), and the loser of the race simply finds the
   * directory already there.
   */
  private static extractTo(dir: string): void {
    const blob = EmbeddedAssets.decode();
    const staging = `${dir}.tmp-${process.pid}-${Date.now()}`;

    try {
      for (const entry of EMBEDDED_ASSETS_INDEX) {
        const destination = path.join(staging, ...entry.p.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, blob.subarray(entry.o, entry.o + entry.l), {
          mode: entry.x ? 0o755 : 0o644,
        });
      }

      fs.writeFileSync(EmbeddedAssets.markerPath(staging), `${EMBEDDED_ASSETS_HASH}\n`);

      try {
        fs.renameSync(staging, dir);
      } catch (error: any) {
        // Another process won the race and created the directory first.
        // Its copy is byte-identical (same content hash), so keep theirs.
        if (fs.existsSync(EmbeddedAssets.markerPath(dir))) {
          fs.rmSync(staging, { recursive: true, force: true });

          return;
        }

        // The directory exists but has no completion marker, so a previous
        // run died part-way through and left a partial tree behind. Rename
        // cannot overwrite a non-empty directory, so clear it and retry.
        // A concurrent extractor is unaffected: it stages into its own
        // directory and only publishes via its own rename.
        if (!fs.existsSync(dir)) throw error;

        fs.rmSync(dir, { recursive: true, force: true });
        try {
          fs.renameSync(staging, dir);
        } catch (retryError: any) {
          // Lost the race during cleanup - whoever won produced identical
          // content, so theirs is just as good.
          if (fs.existsSync(EmbeddedAssets.markerPath(dir))) {
            fs.rmSync(staging, { recursive: true, force: true });

            return;
          }

          throw retryError;
        }
      }
    } catch (error) {
      fs.rmSync(staging, { recursive: true, force: true });

      throw error;
    }
  }

  /**
   * Returns a real directory containing the assets, extracting them first if
   * needed. `siblingDistPath` is the pre-embedding layout (dist/ shipped next
   * to the binary in a release archive) and is used as a fallback when the
   * cache cannot be written - a read-only or unwritable HOME shouldn't turn
   * into a failed build when the assets are already sitting on disk.
   */
  static resolve(siblingDistPath?: string): string {
    const override = process.env[EmbeddedAssets.overrideEnvVar];
    if (override) return override;

    const dir = EmbeddedAssets.targetDir();
    if (fs.existsSync(EmbeddedAssets.markerPath(dir))) return dir;

    try {
      EmbeddedAssets.extractTo(dir);

      return dir;
    } catch (error: any) {
      if (siblingDistPath && fs.existsSync(siblingDistPath)) {
        log.warning(
          `Could not extract embedded assets to ${dir} (${error.message}); ` +
            `falling back to ${siblingDistPath}.`,
        );

        return siblingDistPath;
      }

      throw new Error(String.dedent`
        Could not make the game-ci static assets available on disk.

          extraction target: ${dir}
          reason:            ${error.message}

        These files (build scripts, platform entrypoints, Unity config) are
        mounted into the Docker container, so they need to exist on a real
        path. Set ${EmbeddedAssets.overrideEnvVar} to a writable directory
        holding a dist/ tree to work around this.
      `);
    }
  }
}
