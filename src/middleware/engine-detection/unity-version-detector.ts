import { fsSync as fs, path } from '../../dependencies.ts';
import * as nodeFs from 'node:fs';

export class UnityVersionDetector {
  // Real bug: the old pattern (`/20\d{2}\.\d\.\w{3,4}|3/`) had two
  // separate problems. First, `20\d{2}` only matched a legacy YYYY-scheme
  // major version - Unity 6's "6000.M.PPl#" scheme (e.g. "6000.0.78f1")
  // starts with "6000", not "20xx", so it never matched at all, breaking
  // engine detection for every Unity 6 project. Second, the trailing `|3`
  // alternation - due to regex alternation's low precedence - made the
  // whole pattern effectively `(20\d{2}\.\d\.\w{3,4})|(3)`, so as soon as
  // the first branch failed to match, `.match()` would happily match a
  // bare literal "3" ANYWHERE in the file's contents as a fallback
  // "version".
  //
  // Anchored to Unity's own `m_EditorVersion: <version>` key instead of a
  // floating version-shaped substring search, which is both more correct
  // (no risk of matching something that isn't actually the editor version)
  // and avoids ProjectVersion.txt's second line
  // (`m_EditorVersionWithRevision: <version> (<hash>)`) being mistaken for
  // it. `\d+` (not a fixed `20\d{2}`) covers both the legacy and Unity 6
  // schemes - see RunnerImageTag.versionPattern, which already carries this
  // same fix (game-ci/cli#154, game-ci/unity-builder#847) for a different
  // class of caller (validating an explicit --engineVersion override rather
  // than parsing ProjectVersion.txt).
  static get versionPattern() {
    return /m_EditorVersion:\s*(\d+\.\d+\.\w{1,6})/;
  }

  public static isUnityProject(projectPath: string) {
    try {
      UnityVersionDetector.read(projectPath);

      return true;
    } catch {
      return false;
    }
  }

  static getUnityVersion(projectPath: string) {
    return UnityVersionDetector.read(projectPath);
  }

  static read(projectPath: string) {
    const filePath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
    }

    return UnityVersionDetector.parse(nodeFs.readFileSync(filePath, 'utf-8'));
  }

  static parse(projectVersionTxt: string) {
    const matches = projectVersionTxt.match(UnityVersionDetector.versionPattern);
    if (!matches || matches.length < 2) {
      throw new Error(`Failed to parse version from "${projectVersionTxt}".`);
    }

    // matches[0] is the whole "m_EditorVersion: X" match; matches[1] is the
    // captured version value on its own, which is what every caller of
    // getUnityVersion()/read() actually expects back (a bare version string
    // like "6000.0.78f1", not "m_EditorVersion: 6000.0.78f1").
    return matches[1];
  }
}
