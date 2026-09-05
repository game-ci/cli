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
