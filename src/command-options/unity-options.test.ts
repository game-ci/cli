import { yargs } from '../dependencies.ts';
import { UnityOptions } from './unity-options.ts';

const parserFor = (argv: string[]) =>
  yargs(argv)
    .exitProcess(false)
    .fail((message, error) => {
      throw error || new Error(message);
    });

describe('UnityOptions', () => {
  describe('unityLicensingMethod', () => {
    it('defaults to auto', async () => {
      const parser = parserFor([]);
      await UnityOptions.configure(parser);

      const argv = await parser.parseAsync();

      expect(argv.unityLicensingMethod).toBe('auto');
    });

    it('accepts an explicit method when set', async () => {
      const parser = parserFor(['--unityLicensingMethod', 'personal']);
      await UnityOptions.configure(parser);

      const argv = await parser.parseAsync();

      expect(argv.unityLicensingMethod).toBe('personal');
    });

    it('rejects a method that is not one of the known strategies', async () => {
      const parser = parserFor(['--unityLicensingMethod', 'nonsense']);
      await UnityOptions.configure(parser);

      await expect(parser.parseAsync()).rejects.toThrow();
    });
  });

  describe('unityLicenseFile', () => {
    it('is declared, so environment.ts can actually read it', async () => {
      // Real bug: activate.sh/activate.ps1 have always branched on
      // UNITY_LICENSE_FILE and environment.ts has always read
      // options.unityLicenseFile, but no option ever declared it - so the
      // value was undefined, getEnvVarString dropped it, and the documented
      // flag silently did nothing.
      const parser = parserFor(['--unityLicenseFile', '/tmp/Unity_lic.ulf']);
      await UnityOptions.configure(parser);

      const argv = await parser.parseAsync();

      expect(argv.unityLicenseFile).toBe('/tmp/Unity_lic.ulf');
    });

    it('defaults to empty', async () => {
      const parser = parserFor([]);
      await UnityOptions.configure(parser);

      const argv = await parser.parseAsync();

      expect(argv.unityLicenseFile).toBe('');
    });
  });

  describe('unityLicense coercion', () => {
    it('rejects a .alf and points at the personal method rather than manual activation', async () => {
      // Unity restricted manual (offline) activation to Enterprise/Industry
      // seats, so the old "activate your license file first" advice is
      // unfollowable on a free seat.
      const parser = parserFor(['--unityLicense', 'Unity_v2021.alf']);
      await UnityOptions.configure(parser);

      let thrown: Error | undefined;
      try {
        await parser.parseAsync();
      } catch (error) {
        thrown = error as Error;
      }

      expect(thrown).toBeDefined();
      expect(thrown!.message).toContain('Enterprise and Industry');
      expect(thrown!.message).toContain('personal');
    });

    it('passes license contents through unchanged', async () => {
      const parser = parserFor(['--unityLicense', '<License>contents</License>']);
      await UnityOptions.configure(parser);

      const argv = await parser.parseAsync();

      expect(argv.unityLicense).toBe('<License>contents</License>');
    });
  });
});
