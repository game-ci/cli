import { ImageEnvironmentFactory } from './image-environment-factory.ts';

describe('ImageEnvironmentFactory', () => {
  it('adds shell line continuations for Linux docker env flags', () => {
    const envString = ImageEnvironmentFactory.getEnvVarString({
      hostOS: 'linux',
      unityLicense: 'ci-stub-license',
      engineVersion: '2019.4.40f1',
      projectPath: 'test-project',
      targetPlatform: 'StandaloneLinux64',
      buildName: 'StandaloneLinux64',
      buildPath: 'build/StandaloneLinux64',
      buildFile: 'StandaloneLinux64',
    } as any);

    const lines = envString.split('\n');

    expect(lines).toContain('--env UNITY_LICENSE="ci-stub-license" \\');
    expect(lines).toContain('--env UNITY_VERSION="2019.4.40f1" \\');
    expect(lines).toContain('--env BUILD_TARGET="StandaloneLinux64" \\');
    expect(lines.slice(0, -1).every((line) => line.endsWith(' \\'))).toBe(true);
    expect(lines.at(-1)!.endsWith(' \\')).toBe(false);
  });

  it('keeps PowerShell line continuations for Windows docker env flags', () => {
    const envString = ImageEnvironmentFactory.getEnvVarString({
      hostOS: 'windows',
      unityLicense: 'ci-stub-license',
      engineVersion: '2019.4.40f1',
    } as any);

    const lines = envString.split('\n');

    expect(lines.slice(0, -1).every((line) => line.endsWith(' `'))).toBe(true);
    expect(lines.at(-1)!.endsWith(' `')).toBe(false);
  });
});
