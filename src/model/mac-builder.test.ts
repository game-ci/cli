import { describe, it, expect } from 'bun:test';
import { MacBuilder } from './mac-builder.ts';

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
