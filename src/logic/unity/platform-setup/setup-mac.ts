import { fsSync as fs, getUnityChangeset, Options } from '../../../dependencies.ts';
import System from '../../../model/system/system.ts';

class SetupMac {
  static unityHubBasePath = `/Applications/"Unity Hub.app"`;
  static unityHubExecPath = `${SetupMac.unityHubBasePath}/Contents/MacOS/"Unity Hub"`;

  public static async setup(options: Options) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${options.engineVersion}/Unity.app/Contents/MacOS/Unity`;

    if (!fs.existsSync(this.unityHubExecPath)) {
      if (!options.isRunningLocally)
      {
        await SetupMac.installUnityHub(options);
      } else
      {
        throw new Error(String.dedent`Unity Hub is not installed at the default location. 
        Please install Unity Hub at the default location and try again.`);
      }
    }

    if (!fs.existsSync(unityEditorPath)) {
      if (!options.isRunningLocally)
      {
        await SetupMac.installUnity(options);
      } else
      {
        throw new Error(String.dedent`Unity Editor ${options.engineVersion} is not installed at the default location.
        Please install Unity Editor ${options.engineVersion} at the default location with the necessary modules and try again.`)
      }
    }

    SetupMac.setEnvironmentVariables(options);
  }

  private static async installUnityHub(options: Options, silent = false) {

    const targetHubVersion =
      options.unityHubVersionOnMac !== ''
        ? options.unityHubVersionOnMac
        : await SetupMac.getLatestUnityHubVersion();

    const command = `brew install unity-hub@${targetHubVersion}`;
    
    if (!fs.existsSync(this.unityHubBasePath)) {
      try {
        await System.run(command, undefined, { silent });
      } catch (error) {
        throw new Error(`There was an error installing Unity Hub. See logs above for details. ${error}`);
      }
    }
  }

  /**
   * Gets the latest version of Unity Hub available on brew
   * @returns The latest version of Unity Hub available on brew
   */
  private static async getLatestUnityHubVersion(): Promise<string> {
    // Need to check if the latest version available is the same as the one we have cached
    const hubVersionCommand = `/bin/bash -c "brew info unity-hub | grep -o '[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+'"`;
    const result = await System.run(hubVersionCommand, undefined, { silent: true });
    if (result.status?.code === 0 && result.output !== '') {
      return result.output;
    }

    return '';
  }

  private static getModuleParametersForTargetPlatform(targetPlatform: string): string {
    let moduleArgument = '';
    switch (targetPlatform) {
      case 'iOS':
        moduleArgument += `--module ios `;
        break;
      case 'tvOS':
        moduleArgument += '--module tvos ';
        break;
      case 'StandaloneOSX':
        moduleArgument += `--module mac-il2cpp `;
        break;
      case 'Android':
        moduleArgument += `--module android `;
        break;
      case 'WebGL':
        moduleArgument += '--module webgl ';
        break;
      default:
        throw new Error(`Unsupported module for target platform: ${targetPlatform}.`);
    }

    return moduleArgument;
  }

  private static async installUnity(options: Options, silent = false) {
    const unityChangeset = await getUnityChangeset(options.engineVersion);
    const moduleArgument = SetupMac.getModuleParametersForTargetPlatform(options.targetPlatform);
    
    const command = `${this.unityHubExecPath} -- --headless install \
                                          --version ${options.editorVersion} \
                                          --changeset ${unityChangeset.changeset} \
                                          ${moduleArgument} \
                                          --childModules `;

    try {
      await System.run(command, undefined, { silent });
    } catch (error) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details. ${error}`);
    }
  }

  private static setEnvironmentVariables(options: Options) {
    // Need to set environment variables from here because we execute
    // the scripts on the host for mac
    Deno.env.set('ACTION_FOLDER', options.cliPath);
    Deno.env.set('UNITY_VERSION', options.editorVersion);
    Deno.env.set('UNITY_SERIAL', options.unitySerial);
    Deno.env.set('UNITY_LICENSING_SERVER', options.unityLicensingServer);
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
    Deno.env.set('ANDROID_EXPORT_TYPE', options.androidExportType);
    Deno.env.set('ANDROID_SYMBOL_TYPE', options.androidSymbolType);
    Deno.env.set('CUSTOM_PARAMETERS', options.customParameters);
    Deno.env.set('CHOWN_FILES_TO', options.chownFilesTo);
  }
}

export default SetupMac;
