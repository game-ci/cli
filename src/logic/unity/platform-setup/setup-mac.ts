import { fsSync as fs, getUnityChangeSet, Options } from '../../../dependencies.ts';
import System from '../../../model/system/system.ts';

class SetupMac {
  static unityHubPath = '/Applications/Unity Hub.app/Contents/MacOS/Unity Hub';

  public static async setup(options: Options) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${options.engineVersion}/Unity.app/Contents/MacOS/Unity`;

    // Only install unity if the editor doesn't already exist
    if (!fs.existsSync(unityEditorPath)) {
      await SetupMac.installUnityHub();
      await SetupMac.installUnity(options);
    }

    await SetupMac.setEnvironmentVariables(options);
  }

  private static async installUnityHub(silent = false) {
    const command = 'brew install unity-hub';
    if (!fs.existsSync(this.unityHubPath)) {
      try {
        await System.run(command, { silent, ignoreReturnCode: true });
      } catch (error) {
        throw new Error(`There was an error installing the Unity Editor. See logs above for details. ${error}`);
      }
    }
  }

  private static async installUnity(options: Options, silent = false) {
    const unityChangeSet = await getUnityChangeSet(options.engineVersion);
    const command = `${this.unityHubPath} -- --headless install \
                                          --version ${options.engineVersion} \
                                          --changeset ${unityChangeSet.changeset} \
                                          --module mac-il2cpp \
                                          --childModules`;

    try {
      await System.run(command, { silent, ignoreReturnCode: true });
    } catch (error) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details. ${error}`);
    }
  }

  private static async setEnvironmentVariables(options: Options) {
    // Need to set environment variables from here because we execute
    // the scripts on the host for mac
    Deno.env.set('ACTION_FOLDER', options.cliPath);
    Deno.env.set('UNITY_VERSION', options.editorVersion);
    Deno.env.set('UNITY_SERIAL', options.unitySerial);
    Deno.env.set('PROJECT_PATH', options.projectPath);
    Deno.env.set('BUILD_TARGET', options.targetPlatform);
    Deno.env.set('BUILD_NAME', options.buildName);
    Deno.env.set('BUILD_PATH', options.buildPath);
    Deno.env.set('BUILD_FILE', options.buildFile);
    Deno.env.set('BUILD_METHOD', options.buildMethod);
    Deno.env.set('VERSION', options.buildVersion);
    Deno.env.set('ANDROID_VERSION_CODE', options.androidVersionCode);
    Deno.env.set('ANDROID_KEYSTORE_NAME', options.androidKeystoreName);
    Deno.env.set('ANDROID_KEYSTORE_BASE64', options.androidKeystoreBase64);
    Deno.env.set('ANDROID_KEYSTORE_PASS', options.androidKeystorePass);
    Deno.env.set('ANDROID_KEYALIAS_NAME', options.androidKeyaliasName);
    Deno.env.set('ANDROID_KEYALIAS_PASS', options.androidKeyaliasPass);
    Deno.env.set('ANDROID_TARGET_SDK_VERSION', options.androidTargetSdkVersion);
    Deno.env.set('ANDROID_SDK_MANAGER_PARAMETERS', options.androidSdkManagerParameters);
    Deno.env.set('CUSTOM_PARAMETERS', options.customParameters);
    Deno.env.set('CHOWN_FILES_TO', options.chownFilesTo);
  }
}

export default SetupMac;
