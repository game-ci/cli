import { UnityTargetPlatform } from './unity-target-platform.ts';

describe('UnityTargetPlatform', () => {
  describe('default', () => {
    it('does not throw', () => {
      expect(() => UnityTargetPlatform.default).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof UnityTargetPlatform.default).toStrictEqual('string');
    });
  });

  describe('isWindows', () => {
    it('returns true for windows', () => {
      expect(UnityTargetPlatform.isWindows(UnityTargetPlatform.StandaloneWindows64)).toStrictEqual(true);
    });

    it('returns false for MacOS', () => {
      expect(UnityTargetPlatform.isWindows(UnityTargetPlatform.StandaloneOSX)).toStrictEqual(false);
    });
  });

  describe('isAndroid', () => {
    it('returns true for Android', () => {
      expect(UnityTargetPlatform.isAndroid(UnityTargetPlatform.Android)).toStrictEqual(true);
    });

    it('returns false for Windows', () => {
      expect(UnityTargetPlatform.isAndroid(UnityTargetPlatform.StandaloneWindows64)).toStrictEqual(false);
    });
  });

  describe('determineBuildFileName', () => {
    it('appends .exe for windows targets', () => {
      expect(UnityTargetPlatform.determineBuildFileName('Game', UnityTargetPlatform.StandaloneWindows64, '')).toStrictEqual(
        'Game.exe',
      );
    });

    it('appends .apk for androidPackage', () => {
      expect(
        UnityTargetPlatform.determineBuildFileName('Game', UnityTargetPlatform.Android, 'androidPackage'),
      ).toStrictEqual('Game.apk');
    });

    it('appends .aab for androidAppBundle', () => {
      expect(
        UnityTargetPlatform.determineBuildFileName('Game', UnityTargetPlatform.Android, 'androidAppBundle'),
      ).toStrictEqual('Game.aab');
    });

    it('appends .x86_64 for StandaloneLinux64 by default, matching unity-builder', () => {
      expect(
        UnityTargetPlatform.determineBuildFileName('Game', UnityTargetPlatform.StandaloneLinux64, ''),
      ).toStrictEqual('Game.x86_64');
    });

    it('omits the .x86_64 extension when linux64RemoveExecutableExtension is true', () => {
      expect(
        UnityTargetPlatform.determineBuildFileName('Game', UnityTargetPlatform.StandaloneLinux64, '', true),
      ).toStrictEqual('Game');
    });

    it('leaves other platforms unmodified', () => {
      expect(UnityTargetPlatform.determineBuildFileName('Game', UnityTargetPlatform.StandaloneOSX, '')).toStrictEqual(
        'Game',
      );
    });
  });
});
