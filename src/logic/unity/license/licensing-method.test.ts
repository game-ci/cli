import { resolveLicensingMethod } from './licensing-method.ts';

const options = (overrides: Record<string, unknown> = {}) =>
  ({
    unityLicensingMethod: 'auto',
    unityLicense: '',
    unityLicenseFile: '',
    unitySerial: '',
    unityEmail: '',
    unityPassword: '',
    unityLicensingServer: '',
    ...overrides,
  }) as any;

describe('resolveLicensingMethod', () => {
  describe('auto (the default)', () => {
    it('forwards nothing, leaving each platform script its own unchanged chain', () => {
      // The four activate scripts do not agree on precedence and never have
      // (windows containers check floating before serial; everything else
      // checks serial before floating). Resolving centrally would silently
      // change activation for some existing setup on some platform, so `auto`
      // deliberately forwards no method at all.
      expect(resolveLicensingMethod(options())).toBe('');
    });

    it('forwards nothing even when credentials would clearly imply a strategy', () => {
      expect(
        resolveLicensingMethod(
          options({ unitySerial: 'F4-XXXX', unityEmail: 'ci@example.com', unityPassword: 'pw' }),
        ),
      ).toBe('');
      expect(resolveLicensingMethod(options({ unityLicense: '<License/>' }))).toBe('');
      expect(resolveLicensingMethod(options({ unityLicensingServer: 'http://ls:8080' }))).toBe('');
      expect(resolveLicensingMethod(options({ unityEmail: 'ci@example.com', unityPassword: 'pw' }))).toBe('');
    });

    it('treats a missing unityLicensingMethod as auto', () => {
      // orchestrator and unity-builder both build an options bag by hand and
      // may not set it at all.
      const withoutMethod = options();
      delete withoutMethod.unityLicensingMethod;

      expect(resolveLicensingMethod(withoutMethod)).toBe('');
    });

    it('treats an empty string as auto', () => {
      expect(resolveLicensingMethod(options({ unityLicensingMethod: '' }))).toBe('');
    });
  });

  describe('explicit override', () => {
    it.each(['personal', 'serial', 'floating', 'file'])('forwards %s verbatim', (method) => {
      expect(resolveLicensingMethod(options({ unityLicensingMethod: method }))).toBe(method);
    });

    it('forwards the override regardless of which credentials are set', () => {
      expect(
        resolveLicensingMethod(
          options({
            unityLicensingMethod: 'personal',
            unitySerial: 'F4-XXXX',
            unityLicense: '<License/>',
            unityLicensingServer: 'http://ls:8080',
          }),
        ),
      ).toBe('personal');
    });
  });
});
