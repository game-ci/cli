import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import OrchestratorLogger from '../core/orchestrator-logger';

/**
 * UPM (Unity Package Manager) offline fingerprinting service.
 *
 * Hashes manifest.json + packages-lock.json and stores the fingerprint
 * alongside the cache. When restoring, if the fingerprint matches the
 * current project state, sets UPM_OFFLINE=1 to skip network resolution.
 */
export class UpmCacheService {
  private static readonly FINGERPRINT_FILE = '.game-ci-upm-fingerprint';

  /**
   * Compute a SHA-256 fingerprint from manifest.json and packages-lock.json.
   * Returns hex digest, or undefined if neither file exists.
   */
  static computeFingerprint(projectPath: string): string | undefined {
    const manifestPath = path.join(projectPath, 'Packages', 'manifest.json');
    const lockPath = path.join(projectPath, 'Packages', 'packages-lock.json');

    if (!fs.existsSync(manifestPath) && !fs.existsSync(lockPath)) {
      return undefined;
    }

    const hash = crypto.createHash('sha256');

    if (fs.existsSync(manifestPath)) {
      hash.update(
        fs
          .readFileSync(manifestPath, 'utf8')
          .replace(/\r\n/g, '\n')
          .replace(/^\xEF\xBB\xBF/, ''),
      );
    }

    if (fs.existsSync(lockPath)) {
      hash.update(
        fs
          .readFileSync(lockPath, 'utf8')
          .replace(/\r\n/g, '\n')
          .replace(/^\xEF\xBB\xBF/, ''),
      );
    }

    return hash.digest('hex');
  }

  /**
   * Read the cached UPM fingerprint from the cache directory.
   */
  static readCachedFingerprint(cachePath: string): string | undefined {
    const fingerprintPath = path.join(cachePath, UpmCacheService.FINGERPRINT_FILE);

    try {
      if (fs.existsSync(fingerprintPath)) {
        return fs.readFileSync(fingerprintPath, 'utf8').trim();
      }
    } catch {
      // Unreadable fingerprint treated as missing
    }

    return undefined;
  }

  /**
   * Write the current UPM fingerprint to the cache directory.
   */
  static writeCachedFingerprint(cachePath: string, fingerprint: string): void {
    fs.mkdirSync(cachePath, { recursive: true });
    const fingerprintPath = path.join(cachePath, UpmCacheService.FINGERPRINT_FILE);
    fs.writeFileSync(fingerprintPath, fingerprint, 'utf8');
  }

  /**
   * Compare current project UPM state against cached fingerprint.
   * If they match, sets UPM_OFFLINE=1 in process.env.
   *
   * Returns true if offline mode was enabled.
   */
  static applyOfflineMode(projectPath: string, cachePath: string): boolean {
    try {
      const currentFingerprint = UpmCacheService.computeFingerprint(projectPath);
      if (!currentFingerprint) {
        OrchestratorLogger.log('[UpmCache] No Packages/manifest.json or packages-lock.json found');
        return false;
      }

      const cachedFingerprint = UpmCacheService.readCachedFingerprint(cachePath);
      if (!cachedFingerprint) {
        OrchestratorLogger.log(
          `[UpmCache] No cached fingerprint found, staying online (${currentFingerprint.slice(0, 12)}...)`,
        );
        return false;
      }

      if (cachedFingerprint === currentFingerprint) {
        // NOTE: UPM_OFFLINE is a custom flag consumed by the orchestrator's own
        // build scripts / container hooks — it is NOT a built-in Unity env var.
        // Unity itself does not read this variable; our entrypoint scripts
        // translate it into the appropriate --upmNoResolve CLI flag or
        // upm-config offline setting before launching the editor.
        process.env.UPM_OFFLINE = '1';
        OrchestratorLogger.log(
          `[UpmCache] Fingerprint match (${currentFingerprint.slice(0, 12)}...), UPM_OFFLINE=1`,
        );
        return true;
      }

      OrchestratorLogger.log(
        `[UpmCache] Fingerprint mismatch: cached=${cachedFingerprint.slice(0, 12)}... current=${currentFingerprint.slice(0, 12)}..., staying online`,
      );
      return false;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[UpmCache] Failed to apply offline mode: ${error.message}`);
      return false;
    }
  }

  /**
   * Save the current UPM fingerprint to the cache directory.
   * Call this after a successful build/cache save.
   */
  static saveFingerprint(projectPath: string, cachePath: string): void {
    try {
      const fingerprint = UpmCacheService.computeFingerprint(projectPath);
      if (fingerprint) {
        UpmCacheService.writeCachedFingerprint(cachePath, fingerprint);
        OrchestratorLogger.log(`[UpmCache] Saved fingerprint (${fingerprint.slice(0, 12)}...)`);
      }
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[UpmCache] Failed to save fingerprint: ${error.message}`);
    }
  }
}
