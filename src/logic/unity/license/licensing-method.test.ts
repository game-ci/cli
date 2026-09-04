import { resolveLicensingMethod } from './licensing-method.ts';

const noCredentials = {
  unityLicensingMethod: 'auto',
  unityLicense: '',
  unityLicenseFile: '',
  unitySerial: '',
  unityEmail: '',
  unityPassword: '',
  unityLicensingServer: '',
} as any;

const options = (overrides: Record<string, unknown>) => ({ ...noCredentials, ...overrides }) as any;

describe('resolveLicensingMethod', () => {
  describe('auto', () => {
    it('resolves to serial when a serial and both credentials are set', () => {
      expect(
        resolveLicensingMethod(
          options({ unitySerial: 'F4-XXXX', unityEmail: 'ci@example.com', unityPassword: 'pw' }),
        ),
      ).toBe('serial');
    });

    it('resolves to file for license contents', () => {
      expect(resolveLicensingMethod(options({ unityLicense: '<License>...</License>' }))).toBe('file');
    });

    it('resolves to file for a license file path', () => {
      expect(resolveLicensingMethod(options({ unityLicenseFile: '/tmp/Unity_lic.ulf' }))).toBe('file');
    });

    it('prefers serial over a license file when both are configured', () => {
      // Matches activate.sh's own precedence: a manually-activated .ulf is
      // bound to the machine fingerprint of whichever machine requested it,
      // which doesn't necessarily match the runner. Serial has no such
      // constraint, so given a choice, prefer it.
      expect(
        resolveLicensingMethod(
          options({
            unityLicense: '<License>...</License>',
            unitySerial: 'F4-XXXX',
            unityEmail: 'ci@example.com',
            unityPassword: 'pw',
          }),
        ),
      ).toBe('serial');
    });

    it('resolves to floating for a licensing server', () => {
      expect(resolveLicensingMethod(options({ unityLicensingServer: 'http://localhost:8080' }))).toBe('floating');
    });

    it('prefers floating over personal when a server and account credentials are both set', () => {
      // Floating-server users commonly set unityEmail/unityPassword too.
      // Personal must stay below floating or it would silently steal those
      // runs away from their license server.
      expect(
        resolveLicensingMethod(
          options({
            unityLicensingServer: 'http://localhost:8080',
            unityEmail: 'ci@example.com',
            unityPassword: 'pw',
          }),
        ),
      ).toBe('floating');
    });

    it('resolves to personal for account credentials with nothing else', () => {
      expect(resolveLicensingMethod(options({ unityEmail: 'ci@example.com', unityPassword: 'pw' }))).toBe('personal');
    });

    it('does not resolve to personal without a password', () => {
      expect(resolveLicensingMethod(options({ unityEmail: 'ci@example.com' }))).toBe('');
    });

    it('resolves to nothing when no credentials are configured', () => {
      // The scripts keep their own "could not be determined" guidance for
      // this case rather than duplicating it here.
      expect(resolveLicensingMethod(noCredentials)).toBe('');
    });
  });

  describe('explicit override', () => {
    it('forces personal even when a serial would otherwise win', () => {
      expect(
        resolveLicensingMethod(
          options({
            unityLicensingMethod: 'personal',
            unitySerial: 'F4-XXXX',
            unityEmail: 'ci@example.com',
            unityPassword: 'pw',
          }),
        ),
      ).toBe('personal');
    });

    it('forces serial even when only a license file is configured', () => {
      expect(
        resolveLicensingMethod(options({ unityLicensingMethod: 'serial', unityLicense: '<License/>' })),
      ).toBe('serial');
    });

    it('forces a method even with no credentials at all, so the failure is the script\'s to report', () => {
      expect(resolveLicensingMethod(options({ unityLicensingMethod: 'floating' }))).toBe('floating');
    });

    it('treats a missing unityLicensingMethod as auto', () => {
      // `auto` is a default, not a guarantee - orchestrator and unity-builder
      // both build an options bag by hand and may not set it at all.
      const withoutMethod = { ...noCredentials, unityEmail: 'ci@example.com', unityPassword: 'pw' };
      delete withoutMethod.unityLicensingMethod;

      expect(resolveLicensingMethod(withoutMethod)).toBe('personal');
    });
  });
});
