import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as core from '@actions/core';
import { BuildReliabilityService } from '../reliability/build-reliability-service';

/**
 * Detects submodule profile changes by comparing a hash of the active
 * profile config against a cached fingerprint. When the profile changes,
 * stale compilation artifacts (ScriptAssemblies, Bee) must be cleared
 * to prevent define-symbol mismatches and ghost assembly references.
 */
export class ProfileFingerprintService {
  private static readonly FINGERPRINT_FILE = '.game-ci-profile-fingerprint';

  /**
   * Compute a SHA-256 fingerprint from profile and optional variant YAML files.
   * Returns a hex digest string.
   */
  static computeFingerprint(profilePath: string, variantPath?: string): string {
    const hash = crypto.createHash('sha256');

    if (fs.existsSync(profilePath)) {
      hash.update(fs.readFileSync(profilePath, 'utf8'));
    }

    if (variantPath && fs.existsSync(variantPath)) {
      hash.update(fs.readFileSync(variantPath, 'utf8'));
    }

    return hash.digest('hex');
  }

  /**
   * Read the cached fingerprint from the Library directory.
   * Returns undefined if no cached fingerprint exists.
   */
  static readCachedFingerprint(projectPath: string): string | undefined {
    const fingerprintPath = path.join(
      projectPath,
      'Library',
      ProfileFingerprintService.FINGERPRINT_FILE,
    );

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
   * Write the current fingerprint to the Library directory.
   */
  static writeCachedFingerprint(projectPath: string, fingerprint: string): void {
    const libraryPath = path.join(projectPath, 'Library');
    fs.mkdirSync(libraryPath, { recursive: true });

    const fingerprintPath = path.join(libraryPath, ProfileFingerprintService.FINGERPRINT_FILE);
    fs.writeFileSync(fingerprintPath, fingerprint, 'utf8');
  }

  /**
   * Check whether the active profile has changed since the last build.
   * If changed, clears ScriptAssemblies and Bee to prevent stale artifacts.
   *
   * Returns true if the profile changed and caches were cleared.
   */
  static detectAndClear(projectPath: string, profilePath: string, variantPath?: string): boolean {
    const currentFingerprint = ProfileFingerprintService.computeFingerprint(
      profilePath,
      variantPath,
    );
    const cachedFingerprint = ProfileFingerprintService.readCachedFingerprint(projectPath);

    if (cachedFingerprint === currentFingerprint) {
      core.info(`[ProfileFingerprint] Profile unchanged (${currentFingerprint.slice(0, 12)}...)`);
      return false;
    }

    if (cachedFingerprint) {
      core.info(
        `[ProfileFingerprint] Profile changed: ${cachedFingerprint.slice(0, 12)}... -> ${currentFingerprint.slice(0, 12)}...`,
      );
    } else {
      core.info(
        `[ProfileFingerprint] No cached fingerprint found, establishing baseline: ${currentFingerprint.slice(0, 12)}...`,
      );
    }

    // Clear stale compilation artifacts
    const cleared: string[] = [];
    if (BuildReliabilityService.clearScriptAssemblies(projectPath)) {
      cleared.push('ScriptAssemblies');
    }
    if (BuildReliabilityService.clearBee(projectPath)) {
      cleared.push('Bee');
    }

    if (cleared.length > 0) {
      core.info(`[ProfileFingerprint] Cleared stale artifacts: ${cleared.join(', ')}`);
    }

    // Write the new fingerprint
    ProfileFingerprintService.writeCachedFingerprint(projectPath, currentFingerprint);

    return cachedFingerprint !== undefined; // Only true if there was a previous (different) fingerprint
  }
}
