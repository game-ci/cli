import { describe, it, expect } from 'bun:test';
import { UnityEnvironment } from './environment.ts';

describe('UnityEnvironment', () => {
  describe('audit options (game-ci/cli#65)', () => {
    it('omits the new boolean/string flags when unset', () => {
      const vars = UnityEnvironment.getVariables({} as any);
      const byName = Object.fromEntries(vars.map((v) => [v.name, v.value]));

      expect(byName.BUILD_PROFILE).toBeUndefined();
      expect(byName.SKIP_ACTIVATION).toBe('');
      expect(byName.RUN_AS_HOST_USER).toBe('');
      expect(byName.ENABLE_GPU).toBe('');
      expect(byName.GIT_CONFIG_EXTENSIONS).toBeUndefined();
    });

    it('passes through the new flags when set', () => {
      const vars = UnityEnvironment.getVariables({
        buildProfile: 'Assets/Settings/Linux.asset',
        skipActivation: true,
        runAsHostUser: true,
        enableGpu: true,
        gitConfigExtensions: 'http.sslVerify=false',
      } as any);
      const byName = Object.fromEntries(vars.map((v) => [v.name, v.value]));

      expect(byName.BUILD_PROFILE).toBe('Assets/Settings/Linux.asset');
      expect(byName.SKIP_ACTIVATION).toBe('true');
      expect(byName.RUN_AS_HOST_USER).toBe('true');
      expect(byName.ENABLE_GPU).toBe('true');
      expect(byName.GIT_CONFIG_EXTENSIONS).toBe('http.sslVerify=false');
    });
  });
});
