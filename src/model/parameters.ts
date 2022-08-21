import { default as getHomeDir } from 'https://deno.land/x/dir@1.5.1/home_dir/mod.ts';
import AndroidVersioning from './android-versioning.ts';
import Input from './input.ts';
import Platform from './platform.ts';
import UnityVersioning from './unity-versioning.ts';
import Versioning from './versioning.ts';
import { GitRepoReader } from './input-readers/git-repo.ts';
import { CommandInterface } from '../commands/command/command-interface.ts';
import { Environment } from '../core/env/environment.ts';

class Parameters {
  private command: CommandInterface;
  public editorVersion!: string;
  public customImage!: string;
  public unitySerial!: string;
  public runnerTempPath: string | undefined;
  public targetPlatform!: string;
  public projectPath!: string;
  public buildName!: string;
  public buildPath!: string;
  public buildFile!: string;
  public buildMethod!: string;
  public buildVersion!: string;
  public androidVersionCode!: string;
  public androidKeystoreName!: string;
  public androidKeystoreBase64!: string;
  public androidKeystorePass!: string;
  public androidKeyaliasName!: string;
  public androidKeyaliasPass!: string;
  public androidTargetSdkVersion!: string;
  public androidSdkManagerParameters!: string;
  public customParameters!: string;
  public sshAgent!: string;
  public cloudRunnerCluster!: string;
  public awsBaseStackName!: string;
  public gitPrivateToken!: string;
  public awsStackName!: string;
  public kubeConfig!: string;
  public cloudRunnerMemory!: string;
  public cloudRunnerCpu!: string;
  public kubeVolumeSize!: string;
  public kubeVolume!: string;
  public kubeStorageClass!: string;
  public chownFilesTo!: string;
  public customJobHooks!: string;
  public cachePushOverrideCommand!: string;
  public cachePullOverrideCommand!: string;
  public readInputFromOverrideList!: string;
  public readInputOverrideCommand!: string;
  public checkDependencyHealthOverride!: string;
  public startDependenciesOverride!: string;
  public cacheKey!: string;
  public postBuildSteps!: string;
  public preBuildSteps!: string;
  public customJob!: string;
  public runNumber!: string;
  public branch!: string;
  public githubRepo!: string;
  public gitSha!: string;
  public logId!: string;
  public buildGuid!: string;
  public cloudRunnerBranch!: string;
  public cloudRunnerIntegrationTests!: boolean;
  public cloudRunnerBuilderPlatform!: string | undefined;
  public isCliMode!: boolean;

  private readonly input: Input;
  private readonly env: Environment;

  constructor(input: Input, env: Environment) {
    this.input = input;
    this.env = env;
  }

  public async parse(): Promise<Parameters> {
    const cliStoragePath = `${getHomeDir()}/.game-ci`;

    const buildFile = Parameters.parseBuildFile(
      this.input.buildName,
      this.input.targetPlatform,
      this.input.androidAppBundle,
    );
    log.debug('buildFile:', buildFile);
    const editorVersion = UnityVersioning.determineUnityVersion(this.input.projectPath, this.input.unityVersion);
    log.info('Detected editorVersion', editorVersion);
    const buildVersion = await Versioning.determineBuildVersion(
      this.input.versioningStrategy,
      this.input.specifiedVersion,
      this.input.allowDirtyBuild,
    );
    log.debug('buildVersion', buildVersion);
    const androidVersionCode = AndroidVersioning.determineVersionCode(buildVersion, this.input.androidVersionCode);
    log.debug('androidVersionCode', androidVersionCode);
    const androidSdkManagerParameters = AndroidVersioning.determineSdkManagerParameters(
      this.input.androidTargetSdkVersion,
    );
    log.debug('androidSdkManagerParameters', androidSdkManagerParameters);

    // Commandline takes precedence over environment variables
    const unityEmail = this.input.unityEmail || this.env.get('UNITY_EMAIL');
    const unityPassword = this.input.unityPassword || this.env.get('UNITY_PASSWORD');
    const unityLicense = this.input.unityLicense || this.env.get('UNITY_LICENSE');
    const unityLicenseFile = this.input.unityLicenseFile || this.env.get('UNITY_LICENSE_FILE');
    let unitySerial = this.input.unitySerial || this.env.get('UNITY_SERIAL');

    // For Windows, we need to use the serial from the license file
    if (!unitySerial && this.input.githubInputEnabled) {
      // No serial was present, so it is a personal license that we need to convert
      if (!unityLicense) {
        throw new Error(String.dedent`
          Missing Unity License File and no Serial was found. If this is a personal license,
          make sure to follow the activation steps and set the UNITY_LICENSE variable or enter
          a Unity serial number inside the UNITY_SERIAL variable.
        `);
      }

      unitySerial = this.getSerialFromLicenseFile(this.env.UNITY_LICENSE);
    } else {
      unitySerial = this.env.UNITY_SERIAL!;
    }

    const branch = (await Versioning.getCurrentBranch()) || (await GitRepoReader.GetBranch());
    log.info(`branch: "${branch}"`);

    const projectPath = this.input.projectPath;
    log.info(`projectPath: "${projectPath}"`);

    const targetPlatform = this.input.targetPlatform;
    log.info(`targetPlatform: "${targetPlatform}"`);

    const parameters = {
      cliStoragePath,
      editorVersion,
      customImage: this.input.customImage,
      unityEmail,
      unityPassword,
      unityLicense,
      unityLicenseFile,
      unitySerial,
      usymUploadAuthToken: this.input.usymUploadAuthToken || this.env.get('USYM_UPLOAD_AUTH_TOKEN'),
      runnerTempPath: this.env.RUNNER_TEMP,
      targetPlatform,
      projectPath,
      buildName: this.input.buildName,
      buildPath: `${this.input.buildsPath}/${this.input.targetPlatform}`,
      buildFile,
      buildMethod: this.input.buildMethod,
      buildVersion,
      androidVersionCode,
      androidKeystoreName: this.input.androidKeystoreName,
      androidKeystoreBase64: this.input.androidKeystoreBase64,
      androidKeystorePass: this.input.androidKeystorePass,
      androidKeyaliasName: this.input.androidKeyaliasName,
      androidKeyaliasPass: this.input.androidKeyaliasPass,
      androidTargetSdkVersion: this.input.androidTargetSdkVersion,
      androidSdkManagerParameters,
      customParameters: this.input.customParameters,
      sshAgent: this.input.sshAgent,
      gitPrivateToken: this.input.gitPrivateToken,
      chownFilesTo: this.input.chownFilesTo,
      customJob: this.input.customJob,
      branch,
    };

    const commandParameterOverrides = await this.command.parseParameters(this.input, parameters);

    // Todo - Maybe return an instance instead
    return {
      ...parameters,
      ...commandParameterOverrides,
    };
  }

  static parseBuildFile(filename, platform, androidAppBundle) {
    if (Platform.isWindows(platform)) {
      return `${filename}.exe`;
    }

    if (Platform.isAndroid(platform)) {
      return androidAppBundle ? `${filename}.aab` : `${filename}.apk`;
    }

    return filename;
  }

  static getSerialFromLicenseFile(license) {
    const startKey = `<DeveloperData Value="`;
    const endKey = `"/>`;
    const startIndex = license.indexOf(startKey) + startKey.length;
    if (startIndex < 0) {
      throw new Error(`License File was corrupted, unable to locate serial`);
    }
    const endIndex = license.indexOf(endKey, startIndex);

    // Slice off the first 4 characters as they are garbage values
    return Buffer.from(license.slice(startIndex, endIndex), 'base64').toString('binary').slice(4);
  }

  registerCommand(command: CommandInterface) {
    this.command = command;

    return this;
  }
}

export default Parameters;