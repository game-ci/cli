import { resolveLicensingMethod, preferPersonalOverFile } from './licensing-method.ts';

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
    it('forwards nothing, leaving the platform scripts to resolve their own (now unified) chain', () => {
      // Not a second implementation of the platform scripts' own decision -
      // see this function's own doc comment for why `auto` deliberately
      // forwards nothing at all.
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

describe('preferPersonalOverFile', () => {
  it('switches to personal when a .ulf and full account credentials are both given', () => {
    const opts = options({
      unityLicense: '<License/>',
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(preferPersonalOverFile(opts)).toBe(true);
    expect(opts.unityLicensingMethod).toBe('personal');
  });

  it('does the same for unityLicenseFile (a container-side path, not content)', () => {
    const opts = options({
      unityLicenseFile: '/root/UnityLicenseFile.ulf',
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(preferPersonalOverFile(opts)).toBe(true);
    expect(opts.unityLicensingMethod).toBe('personal');
  });

  it('does nothing when unitySerial is already set - a real serial is never second-guessed', () => {
    const opts = options({
      unityLicense: '<License/>',
      unitySerial: 'F4-XXXX-XXXX-XXXX-XXXX-XXXX',
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(preferPersonalOverFile(opts)).toBe(false);
    expect(opts.unityLicensingMethod).toBe('auto');
  });

  it('does nothing when an explicit non-auto unityLicensingMethod is already set', () => {
    const opts = options({
      unityLicensingMethod: 'file',
      unityLicense: '<License/>',
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(preferPersonalOverFile(opts)).toBe(false);
    expect(opts.unityLicensingMethod).toBe('file');
  });

  it('does nothing without both unityEmail and unityPassword', () => {
    expect(
      preferPersonalOverFile(options({ unityLicense: '<License/>', unityEmail: 'ci@example.com' })),
    ).toBe(false);
    expect(
      preferPersonalOverFile(options({ unityLicense: '<License/>', unityPassword: 'pw123456' })),
    ).toBe(false);
  });

  it('does nothing without a license file at all - nothing to prefer personal over', () => {
    const opts = options({ unityEmail: 'ci@example.com', unityPassword: 'pw123456' });

    expect(preferPersonalOverFile(opts)).toBe(false);
    expect(opts.unityLicensingMethod).toBe('auto');
  });
});
