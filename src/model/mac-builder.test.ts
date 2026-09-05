import { describe, it, expect, mock, afterEach } from 'bun:test';
import { MacBuilder } from './mac-builder.ts';
import { System } from './system/system.ts';
import { UnityBuildValidation } from './unity/build-validation/unity-build-validation.ts';

describe('MacBuilder', () => {
  describe('buildEnv (private, accessed via any-cast)', () => {
    const buildEnv = (options: any): Record<string, string> => (MacBuilder as any).buildEnv(options);

    it('includes generic build options as env vars', () => {
      const env = buildEnv({
        currentWorkDir: '/Users/runner/work/repo/repo',
        cliDistPath: '/Users/runner/work/repo/repo/dist',
        projectPath: 'test-project',
        targetPlatform: 'StandaloneOSX',
        buildName: 'StandaloneOSX',
      });

      expect(env.PROJECT_PATH).toBe('test-project');
      expect(env.BUILD_TARGET).toBe('StandaloneOSX');
      expect(env.BUILD_NAME).toBe('StandaloneOSX');
    });

    it('sets GITHUB_WORKSPACE and ACTION_FOLDER from currentWorkDir/cliDistPath', () => {
      const env = buildEnv({
        currentWorkDir: '/Users/runner/work/repo/repo',
        cliDistPath: '/Users/runner/work/repo/repo/dist',
      });

      expect(env.GITHUB_WORKSPACE).toBe('/Users/runner/work/repo/repo');
      expect(env.ACTION_FOLDER).toBe('/Users/runner/work/repo/repo/dist');
    });

    it('includes Unity-specific env vars only when engine is unity', () => {
      const unityEnv = buildEnv({ engine: 'unity', unitySerial: 'F4-1234-1234-1234' });
      expect(unityEnv.UNITY_SERIAL).toBe('F4-1234-1234-1234');

      const godotEnv = buildEnv({ engine: 'godot', unitySerial: 'F4-1234-1234-1234' });
      expect(godotEnv.UNITY_SERIAL).toBeUndefined();
    });

    it('omits empty/undefined values entirely', () => {
      const env = buildEnv({ projectPath: '', buildName: undefined });
      expect('PROJECT_PATH' in env).toBe(false);
      expect('BUILD_NAME' in env).toBe(false);
    });
  });
});

describe('MacBuilder.run build validation', () => {
  const originalSystemRun = System.run;
  const originalValidateBuild = UnityBuildValidation.validateBuild;

  afterEach(() => {
    System.run = originalSystemRun;
    UnityBuildValidation.validateBuild = originalValidateBuild;
  });

  const baseOptions = { cliDistPath: '/dist', engine: 'unity' } as any;

  // validateBuild throws unless the output contains "Build succeeded!" or a
  // "# Build results #" section. `activate` and `return-license` drive the same
  // mac entrypoint but stop before build.sh, so validating their output failed
  // the command on macOS *after* it had already activated or returned the
  // license.
  it.each([
    ['activateOnly', { activateOnly: true }],
    ['returnLicenseOnly', { returnLicenseOnly: true }],
  ])('skips build validation for %s runs', async (_name, flag) => {
    System.run = mock(() => Promise.resolve({ output: 'Returning personal license seat', error: '' })) as any;
    const validateMock = mock(() => {});
    UnityBuildValidation.validateBuild = validateMock;

    await MacBuilder.run({ ...baseOptions, ...flag });

    expect(validateMock).not.toHaveBeenCalled();
  });

  it('still validates the build for a normal unity build', async () => {
    System.run = mock(() => Promise.resolve({ output: 'Build succeeded!', error: '' })) as any;
    const validateMock = mock(() => {});
    UnityBuildValidation.validateBuild = validateMock;

    await MacBuilder.run(baseOptions);

    expect(validateMock).toHaveBeenCalled();
  });
});
