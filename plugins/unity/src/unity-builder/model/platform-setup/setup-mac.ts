import { BuildParameters } from '..';
import { getUnityChangeset } from 'unity-changeset';
import { exec, getExecOutput } from '@actions/exec';
import { restoreCache, saveCache } from '@actions/cache';

import fs from 'node:fs';

// `log` is a real runtime global set up by src/cli.ts's configureLogger
// before any command runs - plugins/unity's own tsconfig just doesn't know
// its type, since this plugin normally uses @actions/core instead. Declared
// locally rather than switching to core.info/core.warning: console.log's
// output has been confirmed (game-ci/cli#844 investigation) to go missing
// in this exact macOS/compiled-binary context, while `log.info`/`log.warning`
// output (used elsewhere, e.g. mac-builder.ts) reliably appears - unclear
// yet whether @actions/core's plain stdout writes would fare the same as
// console.log's, so this sticks to the mechanism already proven to work.
declare const log: {
  info: (...args: unknown[]) => void;
  warning: (...args: unknown[]) => void;
};

class SetupMac {
  static unityHubBasePath = `/Applications/"Unity Hub.app"`;
  static unityHubExecPath = `${SetupMac.unityHubBasePath}/Contents/MacOS/"Unity Hub"`;

  public static async setup(buildParameters: BuildParameters, actionFolder: string) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${buildParameters.editorVersion}/Unity.app/Contents/MacOS/Unity`;

    if (!fs.existsSync(this.unityHubExecPath.replace(/"/g, ''))) {
      await SetupMac.installUnityHub(buildParameters);
    }

    if (!fs.existsSync(unityEditorPath.replace(/"/g, ''))) {
      await SetupMac.installUnity(buildParameters);
    }

    await SetupMac.setEnvironmentVariables(buildParameters, actionFolder);
  }

  private static async installUnityHub(buildParameters: BuildParameters, silent = false) {
    // Can't use quotes in the cache package so we need a different path
    const unityHubCachePath = `/Applications/Unity\\ Hub.app`;

    const targetHubVersion =
      buildParameters.unityHubVersionOnMac !== ''
        ? buildParameters.unityHubVersionOnMac
        : await SetupMac.getLatestUnityHubVersion();

    const restoreKey = `Cache-MacOS-UnityHub@${targetHubVersion}`;

    if (buildParameters.cacheUnityInstallationOnMac) {
      const cacheId = await restoreCache([unityHubCachePath], restoreKey);
      if (cacheId) {
        // Cache restored successfully, unity hub is installed now
        return;
      }
    }

    const commandSuffix =
      buildParameters.unityHubVersionOnMac !== '' ? `@${buildParameters.unityHubVersionOnMac}` : '';
    const command = `brew install unity-hub${commandSuffix}`;

    // Ignoring return code because the log seems to overflow the internal buffer which triggers
    // a false error
    const errorCode = await exec(command, undefined, {
      silent,
      ignoreReturnCode: true,
    });
    if (errorCode) {
      throw new Error(
        `There was an error installing the Unity Editor. See logs above for details.`,
      );
    }

    if (buildParameters.cacheUnityInstallationOnMac) {
      await saveCache([unityHubCachePath], restoreKey);
    }
  }

  /**
   * Gets the latest version of Unity Hub available on brew
   * @returns The latest version of Unity Hub available on brew
   */
  private static async getLatestUnityHubVersion(): Promise<string> {
    // Need to check if the latest version available is the same as the one we have cached
    const hubVersionCommand = `/bin/bash -c "brew info unity-hub | grep -o '[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+'"`;
    const result = await getExecOutput(hubVersionCommand, undefined, {
      silent: true,
    });
    if (result.exitCode === 0 && result.stdout !== '') {
      return result.stdout;
    }

    return '';
  }

  private static getArchitectureParameters(): string[] {
    const architectureArgument: string[] = [];

    switch (process.arch) {
      case 'x64':
        architectureArgument.push('--architecture', 'x86_64');
        break;
      case 'arm64':
        architectureArgument.push('--architecture', 'arm64');
        break;
      default:
        throw new Error(`Unsupported architecture: ${process.arch}.`);
    }

    return architectureArgument;
  }

  private static getModuleParametersForTargetPlatform(targetPlatform: string): string[] {
    const moduleArgument: string[] = [];
    switch (targetPlatform) {
      case 'iOS':
        moduleArgument.push('--module', 'ios');
        break;
      case 'tvOS':
        moduleArgument.push('--module', 'appletv');
        break;
      case 'VisionOS':
        moduleArgument.push('--module', 'visionos');
        break;
      case 'StandaloneOSX':
        moduleArgument.push('--module', 'mac-il2cpp');
        break;
      case 'Android':
        moduleArgument.push('--module', 'android');
        break;
      case 'WebGL':
        moduleArgument.push('--module', 'webgl');
        break;
      default:
        throw new Error(`Unsupported module for target platform: ${targetPlatform}.`);
    }

    return moduleArgument;
  }

  private static async installUnity(buildParameters: BuildParameters, silent = false) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${buildParameters.editorVersion}`;
    const key = `Cache-MacOS-UnityEditor-With-Module-${buildParameters.targetPlatform}@${buildParameters.editorVersion}`;

    if (buildParameters.cacheUnityInstallationOnMac) {
      const cacheId = await restoreCache([unityEditorPath], key);
      if (cacheId) {
        // Cache restored successfully, unity editor is installed now
        return;
      }
    }

    // #153 removed --changeset based on an untested hypothesis about
    // unity-builder#844's macOS failures; empirically wrong - main's own
    // successful runs invoke Unity Hub WITH --changeset
    // (--version 2021.3.45f2 --changeset 88f88f591b2e ...), confirmed via
    // a real passing CI log. Restored. The actual #844 root cause was
    // -activeBuildProfile's value getting word-split on the bash side
    // (see game-ci/cli#159), unrelated to this flag.
    let unityChangeset: { changeset: string };
    log.info(`[SetupMac] Resolving changeset for editorVersion="${buildParameters.editorVersion}"...`);
    try {
      unityChangeset = await getUnityChangeset(buildParameters.editorVersion);
      log.info(`[SetupMac] Resolved changeset: ${unityChangeset.changeset}`);
    } catch (changesetError) {
      log.info(`[SetupMac] getUnityChangeset FAILED: ${changesetError}`);
      throw changesetError;
    }
    const moduleArguments = SetupMac.getModuleParametersForTargetPlatform(
      buildParameters.targetPlatform,
    );
    const architectureArguments = SetupMac.getArchitectureParameters();

    const execArguments: string[] = [
      '--',
      '--headless',
      'install',
      ...['--version', buildParameters.editorVersion],
      ...['--changeset', unityChangeset.changeset],
      ...moduleArguments,
      ...architectureArguments,
      '--childModules',
    ];

    // Debug instrumentation (game-ci/cli#844 investigation): exec()'s normal
    // [command] echo + live output has been mysteriously absent from CI logs
    // for this exact call - switching to getExecOutput so we capture and
    // print stdout/stderr ourselves, independent of whatever's suppressing
    // exec()'s own listener-based echo in this compiled-binary context.
    log.info(
      `[SetupMac] Running: ${this.unityHubExecPath} ${execArguments.map((a) => JSON.stringify(a)).join(' ')}`,
    );
    const result = await getExecOutput(this.unityHubExecPath, execArguments, {
      silent,
      ignoreReturnCode: true,
    });
    log.info(`[SetupMac] Unity Hub install exit code: ${result.exitCode}`);
    log.info(`[SetupMac] Unity Hub install stdout:\n${result.stdout}`);
    log.info(`[SetupMac] Unity Hub install stderr:\n${result.stderr}`);
    if (result.exitCode) {
      throw new Error(
        `There was an error installing the Unity Editor. See logs above for details.`,
      );
    }

    if (buildParameters.cacheUnityInstallationOnMac) {
      await saveCache([unityEditorPath], key);
    }
  }

  private static async setEnvironmentVariables(
    buildParameters: BuildParameters,
    actionFolder: string,
  ) {
    // Need to set environment variables from here because we execute
    // the scripts on the host for mac
    process.env.ACTION_FOLDER = actionFolder;
    process.env.UNITY_VERSION = buildParameters.editorVersion;
    process.env.UNITY_SERIAL = buildParameters.unitySerial;
    process.env.UNITY_LICENSING_SERVER = buildParameters.unityLicensingServer;
    process.env.SKIP_ACTIVATION = buildParameters.skipActivation;
    process.env.PROJECT_PATH = buildParameters.projectPath;
    process.env.BUILD_PROFILE = buildParameters.buildProfile;
    process.env.BUILD_TARGET = buildParameters.targetPlatform;
    process.env.BUILD_NAME = buildParameters.buildName;
    process.env.BUILD_PATH = buildParameters.buildPath;
    process.env.BUILD_FILE = buildParameters.buildFile;
    process.env.BUILD_METHOD = buildParameters.buildMethod;
    process.env.VERSION = buildParameters.buildVersion;
    process.env.ANDROID_VERSION_CODE = buildParameters.androidVersionCode;
    process.env.ANDROID_KEYSTORE_NAME = buildParameters.androidKeystoreName;
    process.env.ANDROID_KEYSTORE_BASE64 = buildParameters.androidKeystoreBase64;
    process.env.ANDROID_KEYSTORE_PASS = buildParameters.androidKeystorePass;
    process.env.ANDROID_KEYALIAS_NAME = buildParameters.androidKeyaliasName;
    process.env.ANDROID_KEYALIAS_PASS = buildParameters.androidKeyaliasPass;
    process.env.ANDROID_TARGET_SDK_VERSION = buildParameters.androidTargetSdkVersion;
    process.env.ANDROID_SDK_MANAGER_PARAMETERS = buildParameters.androidSdkManagerParameters;
    process.env.ANDROID_EXPORT_TYPE = buildParameters.androidExportType;
    process.env.ANDROID_SYMBOL_TYPE = buildParameters.androidSymbolType;
    process.env.CUSTOM_PARAMETERS = buildParameters.customParameters;
    process.env.CHOWN_FILES_TO = buildParameters.chownFilesTo;
    process.env.MANUAL_EXIT = buildParameters.manualExit.toString();
    process.env.ENABLE_GPU = buildParameters.enableGpu.toString();
  }
}

export default SetupMac;
