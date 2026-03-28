import { AndroidBuildVersionGenerator } from '../middleware/build-versioning/android-build-version-generator.ts';

describe('Android Versioning', () => {
  describe('determineVersionCode', () => {
    it('defaults to 0 when versioning strategy is none', () => {
      expect(AndroidBuildVersionGenerator.determineVersionCode('none')).toBe(0);
    });

    it('defaults to 1 when version is not a valid semver', () => {
      expect(AndroidBuildVersionGenerator.determineVersionCode('abcd')).toBe(1);
    });

    it('returns a number for valid semver', () => {
      expect(AndroidBuildVersionGenerator.determineVersionCode('1.2.3')).toBe(1_002_003);
    });

    it('throws when generated version code is too large', () => {
      expect(() => AndroidBuildVersionGenerator.determineVersionCode('2050.0.0')).toThrow();
    });
  });
});
