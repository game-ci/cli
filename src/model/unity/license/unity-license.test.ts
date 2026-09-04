import { UnityLicense } from './unity-license.ts';
import { UnityLicensingMethod } from './unity-licensing-method.ts';
import { UnityLicensingMethods } from './unity-licensing-methods.ts';

describe('UnityLicense', () => {
  describe('isNonActivatedLicenseFile', () => {
    it('recognises a .alf path', () => {
      expect(UnityLicense.isNonActivatedLicenseFile('Unity_v2021.x.alf')).toBe(true);
    });

    it('does not treat a .ulf as non-activated', () => {
      expect(UnityLicense.isNonActivatedLicenseFile('Unity_lic.ulf')).toBe(false);
    });

    it('does not treat inline license contents as a file', () => {
      expect(UnityLicense.isNonActivatedLicenseFile('<License id="Terms">')).toBe(false);
    });
  });

  describe('isValidLicenseFilePath', () => {
    it('recognises a .ulf path', () => {
      expect(UnityLicense.isValidLicenseFilePath('/etc/unity3d/Unity_lic.ulf')).toBe(true);
    });

    it('rejects a path with any other extension', () => {
      expect(UnityLicense.isValidLicenseFilePath('/etc/unity3d/Unity_lic.txt')).toBe(false);
    });
  });
});

describe('UnityLicensingMethods', () => {
  it('defaults to auto', () => {
    expect(UnityLicensingMethod.default).toBe(UnityLicensingMethod.Auto);
  });

  it('offers every strategy the scripts branch on, plus auto', () => {
    expect(UnityLicensingMethods.all).toEqual(['auto', 'personal', 'serial', 'floating', 'file']);
  });

  it('excludes auto from the resolved list', () => {
    // `auto` is an input, never an outcome - resolveLicensingMethod always
    // turns it into one of these, or into ''.
    expect(UnityLicensingMethods.resolved).not.toContain(UnityLicensingMethod.Auto);
    expect(UnityLicensingMethods.resolved).toEqual(['personal', 'serial', 'floating', 'file']);
  });
});
