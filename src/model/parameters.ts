import { nanoid } from '../dependencies.ts';
import AndroidVersioning from './android-versioning.ts';
import CloudRunnerConstants from './cloud-runner/services/cloud-runner-constants.ts';
import CloudRunnerBuildGuid from './cloud-runner/services/cloud-runner-guid.ts';
import Input from './input.ts';
import Platform from './platform.ts';
import UnityVersioning from './unity-versioning.ts';
import Versioning from './versioning.ts';
import { GitRepoReader } from './input-readers/git-repo.ts';
import { GithubCliReader } from './input-readers/github-cli.ts';
import { Cli } from './cli/cli.ts';
import { EnvVariables } from '../core/env/env-variables.ts';

class Parameters {
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
  private readonly env: EnvVariables;

  constructor(input: Input, env: EnvVariables) {
    this.input = input;
    this.env = env;
  }

  public async parse(): Promise<Parameters> {
    const buildFile = Parameters.parseBuildFile(
      this.input.buildName,
      this.input.targetPlatform,
      this.input.androidAppBundle,
    );
    log.debug('buildFile:', buildFile);
    const editorVersion = UnityVersioning.determineUnityVersion(this.input.projectPath, this.input.unityVersion);
    log.debug('editorVersion:', editorVersion);
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

    // Todo - Don't use process.env directly, that's what the input model class is for.
    // ---
    let unitySerial = '';
    if (!Deno.env.get('UNITY_SERIAL') && this.input.githubInputEnabled) {
      // No serial was present, so it is a personal license that we need to convert
      if (!Deno.env.get('UNITY_LICENSE')) {
        throw new Error(`Missing Unity License File and no Serial was found. If this
                          is a personal license, make sure to follow the activation
                          steps and set the UNITY_LICENSE GitHub secret or enter a Unity
                          serial number inside the UNITY_SERIAL GitHub secret.`);
      }
      unitySerial = this.getSerialFromLicenseFile(Deno.env.get('UNITY_LICENSE'));
    } else {
      unitySerial = Deno.env.get('UNITY_SERIAL')!;
    }

    return {
      editorVersion,
      customImage: this.input.customImage,
      unitySerial,

      runnerTempPath: Deno.env.get('RUNNER_TEMP'),
      targetPlatform: this.input.targetPlatform,
      projectPath: this.input.projectPath,
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
      gitPrivateToken: this.input.gitPrivateToken || (await GithubCliReader.GetGitHubAuthToken()),
      chownFilesTo: this.input.chownFilesTo,
      cloudRunnerCluster: this.input.cloudRunnerCluster,
      cloudRunnerBuilderPlatform: this.input.cloudRunnerBuilderPlatform,
      awsBaseStackName: this.input.awsBaseStackName,
      kubeConfig: this.input.kubeConfig,
      cloudRunnerMemory: this.input.cloudRunnerMemory,
      cloudRunnerCpu: this.input.cloudRunnerCpu,
      kubeVolumeSize: this.input.kubeVolumeSize,
      kubeVolume: this.input.kubeVolume,
      postBuildSteps: this.input.postBuildSteps,
      preBuildSteps: this.input.preBuildSteps,
      customJob: this.input.customJob,
      runNumber: this.input.runNumber,
      branch: this.input.branch.replace('/head', '') || (await GitRepoReader.GetBranch()),
      cloudRunnerBranch: this.input.cloudRunnerBranch.split('/').reverse()[0],
      cloudRunnerIntegrationTests: this.input.cloudRunnerTests,
      githubRepo: this.input.githubRepo || (await GitRepoReader.GetRemote()) || 'game-ci/unity-builder',
      isCliMode: Cli.isCliMode,
      awsStackName: this.input.awsBaseStackName,
      gitSha: this.input.gitSha,
      logId: nanoid.customAlphabet(CloudRunnerConstants.alphabet, 9)(),
      buildGuid: CloudRunnerBuildGuid.generateGuid(this.input.runNumber, this.input.targetPlatform),
      customJobHooks: this.input.customJobHooks(),
      cachePullOverrideCommand: this.input.cachePullOverrideCommand(),
      cachePushOverrideCommand: this.input.cachePushOverrideCommand(),
      readInputOverrideCommand: this.input.readInputOverrideCommand(),
      readInputFromOverrideList: this.input.readInputFromOverrideList(),
      kubeStorageClass: this.input.kubeStorageClass,
      checkDependencyHealthOverride: this.input.checkDependencyHealthOverride,
      startDependenciesOverride: this.input.startDependenciesOverride,
      cacheKey: this.input.cacheKey,
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
}

export default Parameters;
