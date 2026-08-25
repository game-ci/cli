import { fsSync as fs } from "../../../dependencies.ts";
import type { Options } from "../../../dependencies.ts";
import { System } from "../../../model/system/system.ts";

class SetupMac {
  static unityHubBasePath = `/Applications/"Unity Hub.app"`;
  static unityHubExecPath = `${SetupMac.unityHubBasePath}/Contents/MacOS/"Unity Hub"`;

  public static async setup(options: Options) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${options.engineVersion}/Unity.app/Contents/MacOS/Unity`;

    if (!fs.existsSync(this.unityHubExecPath)) {
      if (!options.isRunningLocally) {
        await SetupMac.installUnityHub(options);
      } else {
        throw new Error(String.dedent`Unity Hub is not installed at the default location.
        Please install Unity Hub at the default location and try again.`);
      }
    }

    if (!fs.existsSync(unityEditorPath)) {
      if (!options.isRunningLocally) {
        await SetupMac.installUnity(options);
      } else {
        throw new Error(String.dedent`Unity Editor ${options.engineVersion} is not installed at the default location.
        Please install Unity Editor ${options.engineVersion} at the default location with the necessary modules and try again.`);
      }
    }

    SetupMac.setEnvironmentVariables(options);
  }

  private static async installUnityHub(options: Options, silent = false) {
    // Unity Hub is distributed on Homebrew as a cask, not a formula, so it has no `@version`
    // formula-style pinning by default. Install the unversioned cask (always the latest available)
    // unless the caller explicitly pinned a version, in which case we pass through the
    // `<cask>@<version>` token Homebrew uses for casks that publish versioned taps.
    const versionSuffix = options.unityHubVersionOnMac !== "" ? `@${options.unityHubVersionOnMac}` : "";
    const command = `brew install --cask unity-hub${versionSuffix}`;

    if (!fs.existsSync(this.unityHubBasePath)) {
      try {
        await System.run(command, undefined, { silent });
      } catch (error) {
        throw new Error(`There was an error installing Unity Hub. See logs above for details. ${error}`);
      }
    }
  }

  private static getModuleParametersForTargetPlatform(targetPlatform: string): string {
    let moduleArgument = "";
    switch (targetPlatform) {
      case "iOS":
        moduleArgument += `--module ios `;
        break;
      case "tvOS":
        moduleArgument += "--module tvos ";
        break;
      case "StandaloneOSX":
        moduleArgument += `--module mac-il2cpp `;
        break;
      case "Android":
        moduleArgument += `--module android `;
        break;
      case "WebGL":
        moduleArgument += "--module webgl ";
        break;
      default:
        throw new Error(`Unsupported module for target platform: ${targetPlatform}.`);
    }

    return moduleArgument;
  }

  private static async installUnity(options: Options, silent = false) {
    // Note: getUnityChangeset was removed as a dependency - install by version only
    const moduleArgument = SetupMac.getModuleParametersForTargetPlatform(options.targetPlatform);

    // `Options` has no real `editorVersion` field - only `engineVersion` is
    // ever populated (see engineDetection middleware / #154). The version
    // passed here was silently "undefined" on every single macOS build,
    // which is exactly what Unity Hub CLI's "Provided editor version does
    // not match to any known Unity Editor versions" meant all along -
    // Options being loosely typed let this typo through with no compiler
    // error. See game-ci/cli#844 investigation.
    const command = `${this.unityHubExecPath} -- --headless install \
                                          --version ${options.engineVersion} \
                                          ${moduleArgument} \
                                          --childModules `;

    log.error(`[DEBUG-844] installUnity resolved command: ${command}`);

    try {
      await System.run(command, undefined, { silent });
    } catch (error) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details. ${error}`);
    }
  }

  private static setEnvironmentVariables(options: Options) {
    process.env.ACTION_FOLDER = options.cliPath;
    process.env.UNITY_VERSION = options.engineVersion;
    process.env.UNITY_SERIAL = options.unitySerial;
    process.env.UNITY_LICENSING_SERVER = options.unityLicensingServer;
    process.env.PROJECT_PATH = options.projectPath;
    process.env.BUILD_TARGET = options.targetPlatform;
    process.env.BUILD_NAME = options.buildName;
    process.env.BUILD_PATH = options.buildPath;
    process.env.BUILD_FILE = options.buildFile;
    process.env.BUILD_METHOD = options.buildMethod;
    process.env.VERSION = options.buildVersion;
    process.env.ANDROID_VERSION_CODE = options.androidVersionCode;
    process.env.ANDROID_KEYSTORE_NAME = options.androidKeystoreName;
    process.env.ANDROID_KEYSTORE_BASE64 = options.androidKeystoreBase64;
    process.env.ANDROID_KEYSTORE_PASS = options.androidKeystorePass;
    process.env.ANDROID_KEYALIAS_NAME = options.androidKeyaliasName;
    process.env.ANDROID_KEYALIAS_PASS = options.androidKeyaliasPass;
    process.env.ANDROID_TARGET_SDK_VERSION = options.androidTargetSdkVersion;
    process.env.ANDROID_SDK_MANAGER_PARAMETERS = options.androidSdkManagerParameters;
    process.env.ANDROID_EXPORT_TYPE = options.androidExportType;
    process.env.ANDROID_SYMBOL_TYPE = options.androidSymbolType;
    process.env.CUSTOM_PARAMETERS = options.customParameters;
    process.env.CHOWN_FILES_TO = options.chownFilesTo;
  }
}

export { SetupMac };
