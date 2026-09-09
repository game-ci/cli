import { resolveLicensingMethod, deriveSerialFromLicenseIfNeeded } from './licensing-method.ts';

/** A minimal, real-shaped personal .ulf: <DeveloperData Value="..."/> whose
 * base64 decodes to 4 garbage bytes followed by the serial. */
function ulfContentFor(serial: string): string {
  const encoded = Buffer.from(`XXXX${serial}`).toString('base64');
  return `<License id="Terms"><DeveloperData Value="${encoded}"/></License>`;
}

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

describe('deriveSerialFromLicenseIfNeeded', () => {
  it('extracts the serial and mutates unitySerial in place', () => {
    const opts = options({
      unityLicense: ulfContentFor('F4-XXXX-XXXX-XXXX-XXXX-XXXX'),
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(deriveSerialFromLicenseIfNeeded(opts)).toBe(true);
    expect(opts.unitySerial).toBe('F4-XXXX-XXXX-XXXX-XXXX-XXXX');
  });

  it('completing the triple makes resolveLicensingMethod-adjacent auto precedence pick serial', () => {
    // Doesn't call resolveLicensingMethod itself (that deliberately still
    // forwards '' on auto) - this documents the actual point of the
    // mutation: activate.sh's own auto chain now sees a complete
    // serial+email+password triple, which every platform's existing
    // precedence already puts ahead of `file`.
    const opts = options({
      unityLicense: ulfContentFor('F4-XXXX-XXXX-XXXX-XXXX-XXXX'),
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    deriveSerialFromLicenseIfNeeded(opts);

    expect(opts.unitySerial).toBeTruthy();
    expect(opts.unityEmail).toBeTruthy();
    expect(opts.unityPassword).toBeTruthy();
  });

  it('does nothing when unitySerial is already set', () => {
    const opts = options({
      unityLicense: ulfContentFor('F4-XXXX-XXXX-XXXX-XXXX-XXXX'),
      unitySerial: 'ALREADY-SET',
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(deriveSerialFromLicenseIfNeeded(opts)).toBe(false);
    expect(opts.unitySerial).toBe('ALREADY-SET');
  });

  it('does nothing when an explicit non-auto unityLicensingMethod is set', () => {
    const opts = options({
      unityLicensingMethod: 'file',
      unityLicense: ulfContentFor('F4-XXXX-XXXX-XXXX-XXXX-XXXX'),
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(deriveSerialFromLicenseIfNeeded(opts)).toBe(false);
    expect(opts.unitySerial).toBe('');
  });

  it('does nothing without both unityEmail and unityPassword', () => {
    expect(
      deriveSerialFromLicenseIfNeeded(
        options({ unityLicense: ulfContentFor('F4-XXXX'), unityEmail: 'ci@example.com' }),
      ),
    ).toBe(false);
    expect(
      deriveSerialFromLicenseIfNeeded(
        options({ unityLicense: ulfContentFor('F4-XXXX'), unityPassword: 'pw123456' }),
      ),
    ).toBe(false);
  });

  it('does nothing without a license file', () => {
    expect(
      deriveSerialFromLicenseIfNeeded(options({ unityEmail: 'ci@example.com', unityPassword: 'pw123456' })),
    ).toBe(false);
  });

  it('falls through safely for content that is not a valid personal .ulf', () => {
    const opts = options({
      unityLicense: '<xml>not a license file</xml>',
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(deriveSerialFromLicenseIfNeeded(opts)).toBe(false);
    expect(opts.unitySerial).toBe('');
  });

  it('falls through safely for a DeveloperData tag with no closing marker', () => {
    const opts = options({
      unityLicense: '<DeveloperData Value="not-terminated-properly',
      unityEmail: 'ci@example.com',
      unityPassword: 'pw123456',
    });

    expect(deriveSerialFromLicenseIfNeeded(opts)).toBe(false);
    expect(opts.unitySerial).toBe('');
  });
});
