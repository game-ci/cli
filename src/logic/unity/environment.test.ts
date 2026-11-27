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

  describe('engineLaunchWrapper (ENGINE_LAUNCH_WRAPPER)', () => {
    it('omits ENGINE_LAUNCH_WRAPPER when unset, byte-identical to before this option existed', () => {
      const vars = UnityEnvironment.getVariables({} as any);
      const byName = Object.fromEntries(vars.map((v) => [v.name, v.value]));

      expect(byName.ENGINE_LAUNCH_WRAPPER).toBeUndefined();
    });

    it('passes engineLaunchWrapper through as ENGINE_LAUNCH_WRAPPER when set', () => {
      const vars = UnityEnvironment.getVariables({
        engineLaunchWrapper: 'flock /tmp/unity.lock --',
      } as any);
      const byName = Object.fromEntries(vars.map((v) => [v.name, v.value]));

      expect(byName.ENGINE_LAUNCH_WRAPPER).toBe('flock /tmp/unity.lock --');
    });
  });

  describe('licensing', () => {
    const byNameFor = (options: Record<string, unknown>) =>
      Object.fromEntries(UnityEnvironment.getVariables(options as any).map((v) => [v.name, v.value]));

    it('emits no UNITY_LICENSING_METHOD on auto, leaving detection to the scripts', () => {
      // getEnvVarString drops empty values, so the platform scripts keep using
      // their own original precedence chains - which differ between the
      // windows container set and everything else. Forwarding a centrally
      // resolved method would silently change activation for existing setups.
      expect(byNameFor({ unityEmail: 'ci@example.com', unityPassword: 'pw' }).UNITY_LICENSING_METHOD).toBe('');
      expect(byNameFor({}).UNITY_LICENSING_METHOD).toBe('');
    });

    it('emits UNITY_LICENSING_METHOD when a strategy was explicitly chosen', () => {
      expect(byNameFor({ unityLicensingMethod: 'personal' }).UNITY_LICENSING_METHOD).toBe('personal');
    });

    it('carries UNITY_LICENSE_FILE through, now that the option exists', () => {
      // Previously always undefined - no option declared it, so the value was
      // silently dropped despite three activate scripts branching on it.
      expect(byNameFor({ unityLicenseFile: '/tmp/Unity_lic.ulf' }).UNITY_LICENSE_FILE).toBe('/tmp/Unity_lic.ulf');
    });

    it('emits RETURN_LICENSE_ONLY only when the return-license command set it', () => {
      expect(byNameFor({}).RETURN_LICENSE_ONLY).toBe('');
      expect(byNameFor({ returnLicenseOnly: true }).RETURN_LICENSE_ONLY).toBe('true');
    });

    it('keeps ACTIVATE_ONLY and RETURN_LICENSE_ONLY independent', () => {
      // runsteps.sh exits on ACTIVATE_ONLY before the return step, so setting
      // both would silently skip the return.
      const byName = byNameFor({ returnLicenseOnly: true });

      expect(byName.RETURN_LICENSE_ONLY).toBe('true');
      expect(byName.ACTIVATE_ONLY).toBe('');
    });
  });

  describe('android signing credential forwarding', () => {
    const byNameFor = (options: Record<string, unknown>) =>
      Object.fromEntries(UnityEnvironment.getVariables(options as any).map((v) => [v.name, v.value]));

    it('forwards the canonical parser flags (androidKeyAlias/…Password) to the ANDROID_* env vars', () => {
      // Regression: getVariables read androidKeystorePass / androidKeyaliasName
      // / androidKeyaliasPass, but the parser exposes androidKeystorePassword /
      // androidKeyAlias / androidKeyAliasPassword - so a signed Android build
      // configured with the documented flags reached the container with the
      // keystore password and key alias silently blank.
      const byName = byNameFor({
        androidKeystoreName: 'user.keystore',
        androidKeystorePassword: 'STOREPW',
        androidKeyAlias: 'release-alias',
        androidKeyAliasPassword: 'ALIASPW',
      });

      expect(byName.ANDROID_KEYSTORE_NAME).toBe('user.keystore');
      expect(byName.ANDROID_KEYSTORE_PASS).toBe('STOREPW');
      expect(byName.ANDROID_KEYALIAS_NAME).toBe('release-alias');
      expect(byName.ANDROID_KEYALIAS_PASS).toBe('ALIASPW');
    });

    it('still honours the deprecated aliases as a fallback', () => {
      const byName = byNameFor({
        androidKeystorePass: 'STOREPW',
        androidKeyAliasName: 'release-alias',
        androidKeyAliasPass: 'ALIASPW',
      });

      expect(byName.ANDROID_KEYSTORE_PASS).toBe('STOREPW');
      expect(byName.ANDROID_KEYALIAS_NAME).toBe('release-alias');
      expect(byName.ANDROID_KEYALIAS_PASS).toBe('ALIASPW');
    });

    it('prefers the canonical flag over the deprecated alias when both are set', () => {
      const byName = byNameFor({
        androidKeystorePassword: 'NEWSTORE',
        androidKeystorePass: 'OLDSTORE',
        androidKeyAlias: 'new-alias',
        androidKeyAliasName: 'old-alias',
        androidKeyAliasPassword: 'NEWALIAS',
        androidKeyAliasPass: 'OLDALIAS',
      });

      expect(byName.ANDROID_KEYSTORE_PASS).toBe('NEWSTORE');
      expect(byName.ANDROID_KEYALIAS_NAME).toBe('new-alias');
      expect(byName.ANDROID_KEYALIAS_PASS).toBe('NEWALIAS');
    });
  });
});
