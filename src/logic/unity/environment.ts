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
    ] as DockerParameter[];
  },
};

export { UnityEnvironment };
