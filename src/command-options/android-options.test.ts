import { describe, it, expect, afterEach } from 'bun:test';
import { yargs } from '../dependencies.ts';
import { AndroidOptions } from './android-options.ts';
import { UnityEnvironment } from '../logic/unity/environment.ts';
import { SecretRedaction } from '../model/secret-redaction.ts';
import { ImageEnvironmentFactory } from '../model/image-environment-factory.ts';

/**
 * Public-path regression for the shipped `game-ci build --targetPlatform
 * Android` signing flow: the same AndroidOptions.configure() the build command
 * runs, feeding the same ImageEnvironmentFactory.getEnvVarString() Docker.run
 * uses to build the container `--env` block.
 *
 * The parser exposes androidKeystorePassword / androidKeyAlias /
 * androidKeyAliasPassword; the env builder used to read androidKeystorePass /
 * androidKeyaliasName / androidKeyaliasPass, so these documented flags never
 * reached the container leaving the build process without the supplied signing values.
 */
async function envFromArgs(args: string[], redact = false): Promise<string> {
  const parser = yargs(args)
    .exitProcess(false)
    .fail((message: string, error: Error) => {
      throw error || new Error(message);
    });

  await AndroidOptions.configure(parser as any);

  const argv = (await parser.parseAsync()) as any;

  const envString = ImageEnvironmentFactory.getEnvVarString(
    { hostOS: 'linux', engine: 'unity', ...argv } as any,
    UnityEnvironment.getVariables({ engine: 'unity', ...argv } as any),
  );
  if (redact) {
    SecretRedaction.registerFromOptions(argv);
    return SecretRedaction.redact(envString);
  }
  return envString;
}

afterEach(() => SecretRedaction.reset());

describe('AndroidOptions signing flags reach the container env', () => {
  it('forwards keystore/keyalias credentials passed via the canonical flags', async () => {
    const envString = await envFromArgs([
      '--androidKeystoreName',
      'user.keystore',
      '--androidKeystorePassword',
      'STOREPW',
      '--androidKeyAlias',
      'release-alias',
      '--androidKeyAliasPassword',
      'ALIASPW',
    ]);

    expect(envString).toContain('--env ANDROID_KEYSTORE_NAME="user.keystore"');
    expect(envString).toContain('--env ANDROID_KEYSTORE_PASS="STOREPW"');
    expect(envString).toContain('--env ANDROID_KEYALIAS_NAME="release-alias"');
    expect(envString).toContain('--env ANDROID_KEYALIAS_PASS="ALIASPW"');
  });

  it('still forwards credentials passed via the deprecated aliases', async () => {
    const envString = await envFromArgs([
      '--androidKeystorePass',
      'STOREPW',
      '--androidKeyAliasName',
      'release-alias',
      '--androidKeyAliasPass',
      'ALIASPW',
    ]);

    expect(envString).toContain('--env ANDROID_KEYSTORE_PASS="STOREPW"');
    expect(envString).toContain('--env ANDROID_KEYALIAS_NAME="release-alias"');
    expect(envString).toContain('--env ANDROID_KEYALIAS_PASS="ALIASPW"');
  });
});

describe('Android signing compatibility and logging', () => {
  it('retains the previously consumed lowercase keyalias spellings', async () => {
    const envString = await envFromArgs([
      '--androidKeyaliasName', 'legacy-alias', '--androidKeyaliasPass', 'legacy-password',
    ]);
    expect(envString).toContain('--env ANDROID_KEYALIAS_NAME="legacy-alias"');
    expect(envString).toContain('--env ANDROID_KEYALIAS_PASS="legacy-password"');
  });

  for (const [storeFlag, aliasFlag, passwordFlag] of [
    ['--androidKeystorePassword', '--androidKeyAlias', '--androidKeyAliasPassword'],
    ['--androidKeystorePass', '--androidKeyAliasName', '--androidKeyAliasPass'],
  ]) {
    it(`masks forwarded passwords from ${storeFlag} and ${passwordFlag}`, async () => {
      const envString = await envFromArgs([
        storeFlag, 'synthetic-store-password', aliasFlag, 'release-alias',
        passwordFlag, 'synthetic-alias-password',
      ], true);
      expect(envString).toContain('--env ANDROID_KEYSTORE_PASS="***"');
      expect(envString).toContain('--env ANDROID_KEYALIAS_PASS="***"');
      expect(envString).toContain('--env ANDROID_KEYALIAS_NAME="release-alias"');
      expect(envString).not.toContain('synthetic-store-password');
      expect(envString).not.toContain('synthetic-alias-password');
    });
  }
});
