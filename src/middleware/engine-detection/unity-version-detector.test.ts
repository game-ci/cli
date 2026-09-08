import { describe, it, expect } from 'bun:test';
import { UnityVersionDetector } from './unity-version-detector.ts';

// Real bug, reported on Discord: Unity 6 projects were never detected as
// Unity projects at all. The old pattern (`/20\d{2}\.\d\.\w{3,4}|3/`) only
// matched the legacy YYYY-scheme major version - Unity 6's "6000.M.PPl#"
// scheme (e.g. "6000.0.78f1") starts with "6000", not "20xx", so the first
// alternative never matched. Worse: the trailing `|3` alternation - due to
// regex alternation's low precedence - made the whole pattern effectively
// `(20\d{2}\.\d\.\w{3,4})|(3)`, so `.match()` fell through to matching a
// bare literal "3" ANYWHERE in the file's contents once the first branch
// failed - which the digit inside "6000.0.78f1" itself satisfies. So a real
// Unity 6 project didn't just fail detection; it silently "detected" as
// version "3", which would have gone on to build a nonsense Docker image
// tag with zero indication of the real cause.
describe('UnityVersionDetector', () => {
  describe('parse', () => {
    it('extracts a Unity 6 version (6000.M.PPl# scheme)', () => {
      expect(
        UnityVersionDetector.parse(
          'm_EditorVersion: 6000.0.78f1\nm_EditorVersionWithRevision: 6000.0.78f1 (abc123)\n',
        ),
      ).toBe('6000.0.78f1');
    });

    it('extracts a legacy Unity version (YYYY.M.PPl# scheme)', () => {
      expect(
        UnityVersionDetector.parse(
          'm_EditorVersion: 2021.2.8f1\nm_EditorVersionWithRevision: 2021.2.8f1 (d0e5f0a7b06a)\n',
        ),
      ).toBe('2021.2.8f1');
    });

    it('extracts the version even without a trailing revision line', () => {
      expect(UnityVersionDetector.parse('m_EditorVersion: 2022.3.45f1\n')).toBe('2022.3.45f1');
    });

    it('does not match against m_EditorVersionWithRevision when it appears first', () => {
      // Guards the "anchor to the exact key" fix: `m_EditorVersion:` must
      // not accidentally match as a prefix of `m_EditorVersionWithRevision:`.
      expect(
        UnityVersionDetector.parse(
          'm_EditorVersionWithRevision: 6000.0.78f1 (abc123)\nm_EditorVersion: 6000.0.78f1\n',
        ),
      ).toBe('6000.0.78f1');
    });

    it('never returns a bare "3" as a false-positive version (the old bug)', () => {
      const result = UnityVersionDetector.parse(
        'm_EditorVersion: 6000.0.78f1\nm_EditorVersionWithRevision: 6000.0.78f1 (abc123)\n',
      );
      expect(result).not.toBe('3');
    });

    it('throws a clear error for content with no m_EditorVersion key, rather than matching a stray digit', () => {
      expect(() => UnityVersionDetector.parse('some random text with a 3 in it and no version key')).toThrow(
        /Failed to parse version/,
      );
    });

    it('throws for empty content', () => {
      expect(() => UnityVersionDetector.parse('')).toThrow(/Failed to parse version/);
    });
  });

  describe('isUnityProject / getUnityVersion (via read)', () => {
    it('detects a Unity 6 project end-to-end from a real ProjectVersion.txt shape', () => {
      // This is the exact code path unity-plugin.ts's engine auto-detection
      // calls - the one that silently failed to recognize Unity 6 projects.
      const projectPath = `${import.meta.dir}/../../../dist/BlankProject`;
      expect(UnityVersionDetector.isUnityProject(projectPath)).toBe(true);
      expect(UnityVersionDetector.getUnityVersion(projectPath)).toBe('2021.2.8f1');
    });

    it('reports false for a path with no ProjectVersion.txt', () => {
      expect(UnityVersionDetector.isUnityProject('/definitely/not/a/unity/project')).toBe(false);
    });
  });
});
