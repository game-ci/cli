import type { Options } from '../../dependencies.ts';
import { DockerParameter } from '../../model/image-environment-factory.ts';

/**
 * Unity-specific Docker env vars — moved out of the engine-agnostic
 * ImageEnvironmentFactory (game-ci/cli#51 phase 2). Passed as
 * ImageEnvironmentFactory.getEnvVarString(options, UnityEnvironment.getVariables(options))
 * by unity-build-command.ts only; Godot/Unreal builds don't get these.
 */
const UnityEnvironment = {
  getVariables(options: Options): DockerParameter[] {
    return [
      { name: 'UNITY_LICENSE', value: options.unityLicense },
      { name: 'UNITY_LICENSE_FILE', value: options.unityLicenseFile },
      { name: 'UNITY_EMAIL', value: options.unityEmail },
      { name: 'UNITY_PASSWORD', value: options.unityPassword },
      { name: 'UNITY_SERIAL', value: options.unitySerial },
      { name: 'UNITY_LICENSING_SERVER', value: options.unityLicensingServer },
      // Consumed by dist/platforms/mac/steps/activate.sh + build.sh's retry
      // loop around known-transient licensing errors. Currently mac-only
      // (Windows/Ubuntu build through Docker, where a container failure
      // isn't the same class of flaky host-process license handshake), but
      // an engine-wide env var rather than a mac-specific one since nothing
      // about the option itself is mac-specific.
      { name: 'UNITY_LICENSE_RETRY_MAX_ATTEMPTS', value: options.licenseRetryMaxAttempts?.toString() },
      // Not a documented core CLI option (core build/test/activate stay
      // lean) - this is Orchestrator's advanced-ops surface
      // (--engineLaunchWrapper on `orchestrate`). Reading the raw env var
      // directly here still lets it reach Docker.run's non-Unity branch for
      // Godot/Unreal, since Orchestrator has no equivalent script chain for
      // those engines to own this instead.
      { name: 'ENGINE_LAUNCH_WRAPPER', value: options.engineLaunchWrapper || process.env.ENGINE_LAUNCH_WRAPPER },
      { name: 'UNITY_VERSION', value: options.engineVersion },
      { name: 'USYM_UPLOAD_AUTH_TOKEN', value: options.uploadAuthToken },
      { name: 'ANDROID_VERSION_CODE', value: options.androidVersionCode },
      { name: 'ANDROID_KEYSTORE_NAME', value: options.androidKeystoreName },
      { name: 'ANDROID_KEYSTORE_BASE64', value: options.androidKeystoreBase64 },
      { name: 'ANDROID_KEYSTORE_PASS', value: options.androidKeystorePass },
      { name: 'ANDROID_KEYALIAS_NAME', value: options.androidKeyaliasName },
      { name: 'ANDROID_KEYALIAS_PASS', value: options.androidKeyaliasPass },
      { name: 'ANDROID_TARGET_SDK_VERSION', value: options.androidTargetSdkVersion },
      { name: 'ANDROID_SDK_MANAGER_PARAMETERS', value: options.androidSdkManagerParameters },
      { name: 'ANDROID_EXPORT_TYPE', value: options.androidExportType },
      { name: 'ANDROID_SYMBOL_TYPE', value: options.androidSymbolType },
      { name: 'MANUAL_EXIT', value: options.manualExit ? 'true' : '' },
      { name: 'BUILD_PROFILE', value: options.buildProfile },
      { name: 'SKIP_ACTIVATION', value: options.skipActivation ? 'true' : '' },
      { name: 'ACTIVATE_ONLY', value: options.activateOnly ? 'true' : '' },
      { name: 'RUN_AS_HOST_USER', value: options.runAsHostUser ? 'true' : '' },
      { name: 'ENABLE_GPU', value: options.enableGpu ? 'true' : '' },
      { name: 'GIT_CONFIG_EXTENSIONS', value: options.gitConfigExtensions },
      // Consumed by dist/platforms/*/steps/runsteps.sh + test.sh (`game-ci
      // test --docker`, see UnityTestCommand) - a no-op for build/activate
      // since these are all empty/undefined there and getEnvVarString drops
      // empty values.
      { name: 'RUN_TESTS', value: options.runTests ? 'true' : '' },
      { name: 'TEST_PLATFORMS', value: options.testPlatforms },
      { name: 'ARTIFACTS_PATH', value: options.artifactsPath },
      { name: 'COVERAGE_RESULTS_PATH', value: options.coverageResultsPath },
      { name: 'COVERAGE_OPTIONS', value: options.coverageOptions },
      { name: 'COVERAGE_ENABLED', value: options.coverageEnabled === false ? 'false' : 'true' },
      { name: 'PACKAGE_MODE', value: options.packageMode ? 'true' : '' },
      { name: 'PACKAGE_NAME', value: options.packageName },
      { name: 'SCOPED_REGISTRY_URL', value: options.scopedRegistryUrl },
      { name: 'REGISTRY_SCOPES', value: options.registryScopes },
      { name: 'PRIVATE_REGISTRY_TOKEN', value: options.privateRegistryToken },
      { name: 'PRIVATE_REGISTRY_USER', value: options.privateRegistryUser },
    ] as DockerParameter[];
  },
};

export { UnityEnvironment };
