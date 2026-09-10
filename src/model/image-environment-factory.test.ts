import { ImageEnvironmentFactory } from './image-environment-factory.ts';
import { UnityEnvironment } from '../logic/unity/environment.ts';

describe('ImageEnvironmentFactory', () => {
  it('adds shell line continuations for Linux docker env flags', () => {
    const options = {
      hostOS: 'linux',
      unityLicense: 'ci-stub-license',
      engineVersion: '2019.4.40f1',
      projectPath: 'test-project',
      targetPlatform: 'StandaloneLinux64',
      buildName: 'StandaloneLinux64',
      buildPath: 'build/StandaloneLinux64',
      buildFile: 'StandaloneLinux64',
    } as any;
    const envString = ImageEnvironmentFactory.getEnvVarString(options, UnityEnvironment.getVariables(options));

    const lines = envString.split('\n');

    expect(lines).toContain('--env UNITY_LICENSE="ci-stub-license" \\');
    expect(lines).toContain('--env UNITY_VERSION="2019.4.40f1" \\');
    expect(lines).toContain('--env BUILD_TARGET="StandaloneLinux64" \\');
    expect(lines.slice(0, -1).every((line) => line.endsWith(' \\'))).toBe(true);
    expect(lines.at(-1)!.endsWith(' \\')).toBe(false);
  });

  it('keeps PowerShell line continuations for Windows docker env flags', () => {
    const options = {
      hostOS: 'windows',
      unityLicense: 'ci-stub-license',
      engineVersion: '2019.4.40f1',
    } as any;
    const envString = ImageEnvironmentFactory.getEnvVarString(options, UnityEnvironment.getVariables(options));

    const lines = envString.split('\n');

    expect(lines.slice(0, -1).every((line) => line.endsWith(' `'))).toBe(true);
    expect(lines.at(-1)!.endsWith(' `')).toBe(false);
  });

  it('omits engine-specific env vars when no extraVariables are given (Godot/Unreal path)', () => {
    const envString = ImageEnvironmentFactory.getEnvVarString({
      hostOS: 'linux',
      projectPath: 'test-project',
      targetPlatform: 'StandaloneLinux64',
    } as any);

    expect(envString).not.toContain('UNITY_LICENSE');
    expect(envString).toContain('--env PROJECT_PATH="test-project"');
  });

  it('escapes double quotes so sh cannot close the value early', () => {
    // A customParameters value with embedded quotes ended the `"..."` wrapper
    // at the first inner quote; the `;` after it then split the docker command
    // in two, and `docker run` was left without an image.
    const customParameters =
      '-testCategory "!IgnoreCI;!Integration" -testHelperScreenshotDirectory /github/workspace/artifacts/Screenshots';
    const envString = ImageEnvironmentFactory.getEnvVarString({ hostOS: 'linux', customParameters } as any);

    expect(envString).toContain(
      '--env CUSTOM_PARAMETERS="-testCategory \\"!IgnoreCI;!Integration\\" -testHelperScreenshotDirectory /github/workspace/artifacts/Screenshots"',
    );
  });

  it('escapes backslash, dollar and backtick so sh passes them through literally', () => {
    const envString = ImageEnvironmentFactory.getEnvVarString({
      hostOS: 'linux',
      customParameters: 'a$HOME `id` b\\c',
    } as any);

    expect(envString).toContain('--env CUSTOM_PARAMETERS="a\\$HOME \\`id\\` b\\\\c"');
  });

  it('doubles single quotes inside PowerShell single-quoted values', () => {
    const envString = ImageEnvironmentFactory.getEnvVarString({
      hostOS: 'windows',
      customParameters: "-name O'Brien",
    } as any);

    expect(envString).toContain("--env CUSTOM_PARAMETERS='-name O''Brien'");
  });

  it('omits MANUAL_EXIT by default', () => {
    const options = { hostOS: 'linux' } as any;
    const envString = ImageEnvironmentFactory.getEnvVarString(options, UnityEnvironment.getVariables(options));
    expect(envString).not.toContain('MANUAL_EXIT');
  });

  it('sets MANUAL_EXIT when options.manualExit is true', () => {
    const options = { hostOS: 'linux', manualExit: true } as any;
    const envString = ImageEnvironmentFactory.getEnvVarString(options, UnityEnvironment.getVariables(options));
    expect(envString).toContain('--env MANUAL_EXIT="true"');
  });
});

describe('ImageEnvironmentFactory.getInheritedEnvVars', () => {
  const options = (unityLicense: string) =>
    ({ engine: 'unity', hostOS: 'linux', unityLicense }) as any;

  const multiline = '<root>\n  <License id="Terms"/>\n</root>';

  it('returns multiline values so the docker client can inherit them', () => {
    // getEnvVarString emits a bare `--env UNITY_LICENSE` for these, which only
    // works if the value is actually in the child's environment.
    const inherited = ImageEnvironmentFactory.getInheritedEnvVars(options(multiline), [
      { name: 'UNITY_LICENSE', value: multiline },
    ] as any);

    expect(inherited.UNITY_LICENSE).toBe(multiline);
  });

  it('omits single-line values, which are inlined in the command instead', () => {
    const inherited = ImageEnvironmentFactory.getInheritedEnvVars(options('single-line'), [
      { name: 'UNITY_LICENSE', value: 'single-line' },
    ] as any);

    expect(inherited.UNITY_LICENSE).toBeUndefined();
  });

  it('does not carry a value over from a previous call', () => {
    // Regression: this used to be cached in process.env and only written when
    // unset, so a second invocation with a different license silently reused
    // the first one's value.
    const first = '<root>\n  <License id="A"/>\n</root>';
    const second = '<root>\n  <License id="B"/>\n</root>';

    ImageEnvironmentFactory.getInheritedEnvVars(options(first), [{ name: 'UNITY_LICENSE', value: first }] as any);
    const inherited = ImageEnvironmentFactory.getInheritedEnvVars(options(second), [
      { name: 'UNITY_LICENSE', value: second },
    ] as any);

    expect(inherited.UNITY_LICENSE).toBe(second);
    expect(process.env.UNITY_LICENSE).toBeUndefined();
  });
});

describe('ImageEnvironmentFactory dockerEnv', () => {
  // The container inherits a fixed allowlist rather than the surrounding
  // environment, so a user with an env-var-driven Unity setting (most often
  // IL2CPP_ADDITIONAL_ARGS) had no supported way to reach it at all. --dockerEnv
  // is that way; these cover the shapes it actually arrives in.
  it('parses a newline-separated block, as a GitHub Actions block scalar produces', () => {
    const parsed = ImageEnvironmentFactory.parseUserEnvironmentVariables(
      'IL2CPP_ADDITIONAL_ARGS=--maxcpucount=2\nFOO=bar\n',
    );

    expect(parsed).toEqual([
      { name: 'IL2CPP_ADDITIONAL_ARGS', value: '--maxcpucount=2' },
      { name: 'FOO', value: 'bar' },
    ] as any);
  });

  it('parses repeated flags', () => {
    expect(ImageEnvironmentFactory.parseUserEnvironmentVariables(['A=1', 'B=2'])).toEqual([
      { name: 'A', value: '1' },
      { name: 'B', value: '2' },
    ] as any);
  });

  it('splits on the first = only, so values containing = survive', () => {
    // IL2CPP arguments essentially always contain one.
    const [parsed] = ImageEnvironmentFactory.parseUserEnvironmentVariables('IL2CPP_ADDITIONAL_ARGS=--maxcpucount=2');

    expect(parsed.value).toBe('--maxcpucount=2');
  });

  it('skips blank lines and # comments so a block can be annotated', () => {
    expect(ImageEnvironmentFactory.parseUserEnvironmentVariables('# limit workers\n\nA=1\n')).toEqual([
      { name: 'A', value: '1' },
    ] as any);
  });

  it('rejects an entry with no =, rather than silently dropping it', () => {
    expect(() => ImageEnvironmentFactory.parseUserEnvironmentVariables('NOEQUALS')).toThrow(/Expected NAME=value/);
  });

  it('is a no-op when unset', () => {
    expect(ImageEnvironmentFactory.parseUserEnvironmentVariables(undefined)).toEqual([]);
    expect(ImageEnvironmentFactory.parseUserEnvironmentVariables([])).toEqual([]);
  });

  it('appends after the built-ins so a user value wins on collision', () => {
    // Docker takes the last --env for a given name.
    const vars = ImageEnvironmentFactory.getEnvironmentVariables({
      projectPath: '.',
      targetPlatform: 'StandaloneWindows64',
      dockerEnv: ['BUILD_TARGET=Overridden'],
    } as any);

    const matches = vars.filter((p) => p.name === 'BUILD_TARGET');

    expect(matches).toHaveLength(2);
    expect(matches[matches.length - 1].value).toBe('Overridden');
  });

  it('reaches the docker command as a real --env flag', () => {
    const envString = ImageEnvironmentFactory.getEnvVarString({
      hostOS: 'linux',
      projectPath: '.',
      dockerEnv: ['IL2CPP_ADDITIONAL_ARGS=--maxcpucount=2'],
    } as any);

    expect(envString).toContain('--env IL2CPP_ADDITIONAL_ARGS="--maxcpucount=2"');
  });
});
