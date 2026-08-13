import { ImageEnvironmentFactory } from './image-environment-factory.ts';
import { path, fsSync as fs } from '../dependencies.ts';
import type { Options } from '../dependencies.ts';
import { System } from './system/system.ts';
import { UnityBuildValidation } from './unity/build-validation/unity-build-validation.ts';
import { UnityEnvironment } from '../logic/unity/environment.ts';

/** UNITY_LICENSE/ANDROID_* etc. only make sense inside a Unity container. */
function engineEnvVars(options: Options) {
  return options.engine === 'unity' ? UnityEnvironment.getVariables(options) : [];
}

class Docker {
  static async run(image: string, options: Options) {
    const { hostPlatform, hostOS, engine } = options;

    log.warning(`running docker process for ${hostOS} (${hostPlatform})`);

    let command = '';
    switch (hostOS) {
      case 'windows': {
        // Todo: check if docker daemon is set for Windows or Linux containers.
        command = await this.getWindowsCommand(image, options);
        break;
      }
      case 'linux':
      case 'darwin': {
        command = await this.getLinuxCommand(image, options);
        break;
      }
    }

    try {
      if (log.isVeryVerbose) log.debug(`docker command: ${command}`);

      const dockerRun = await System.run(command);

      switch (engine) {
        case 'unity':
          UnityBuildValidation.validateBuild(dockerRun.output);
          break;
      }
    } catch (error: any) {
      if (error.message.includes('docker: image operating system "windows" cannot be used on this platform')) {
        throw new Error(String.dedent`
          Docker daemon is not set to run Windows containers.

          To enable the Hyper-V container backend run:
            Enable-WindowsOptionalFeature -Online -FeatureName $("Microsoft-Hyper-V", "Containers") -All

          To switch the docker daemon to run Windows containers run:
            & $Env:ProgramFiles\\Docker\\Docker\\DockerCli.exe -SwitchDaemon .

          For more information see:
            https://docs.microsoft.com/en-us/virtualization/windowscontainers/quick-start/set-up-environment?tabs=dockerce#prerequisites
        `);
      }

      throw error;
    }
  }

  private static getLinuxCommand(image: string, options: Options): string {
    const { currentWorkDir, homeDir, cliDistPath, runnerTempPath, sshAgent, gitPrivateToken, dockerWorkspacePath, commands, engine } =
      options as Options & { commands?: string };

    const home = homeDir;
    const envVarString = ImageEnvironmentFactory.getEnvVarString(options, engineEnvVars(options)).replace(/ \\\n/g, ' ');

    // Non-Unity engines (Godot, Unreal) supply their own container command
    // via `commands` instead of Unity's license-activate-build-return
    // entrypoint.sh flow — this used to be silently ignored here, so any
    // build with `engine !== 'unity'` always ran Unity's entrypoint instead
    // of the command the engine plugin actually asked for.
    const isUnityDefaultFlow = !commands || engine === 'unity';

    return [
      'docker run',
      '--rm',
      `--workdir ${dockerWorkspacePath}`,
      envVarString,
      isUnityDefaultFlow ? '--env UNITY_SERIAL' : '',
      `--env GITHUB_WORKSPACE=${dockerWorkspacePath}`,
      gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : '',
      sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : '',
      `--volume "${home}":"/root:z"`,
      `--volume "${currentWorkDir}":"${dockerWorkspacePath}:z"`,
      isUnityDefaultFlow ? `--volume "${cliDistPath}/default-build-script:/UnityBuilderAction:z"` : '',
      isUnityDefaultFlow ? `--volume "${cliDistPath}/platforms/ubuntu/steps:/steps:z"` : '',
      isUnityDefaultFlow ? `--volume "${cliDistPath}/platforms/ubuntu/entrypoint.sh:/entrypoint.sh:z"` : '',
      isUnityDefaultFlow ? `--volume "${cliDistPath}/unity-config:/usr/share/unity3d/config:z"` : '',
      sshAgent ? `--volume ${sshAgent}:/ssh-agent` : '',
      sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : '',
      image,
      isUnityDefaultFlow ? '/bin/bash /entrypoint.sh' : commands!,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private static getWindowsCommand(image: string, options: Options): string {
    const { currentWorkDir, homeDir, cliDistPath, unitySerial, gitPrivateToken, cliStoragePath, dockerWorkspacePath, commands, engine } =
      options as Options & { commands?: string };

    // Same "don't force Unity's flow onto a non-Unity engine" fix as
    // getLinuxCommand — see the comment there. No engine currently ships a
    // Windows Docker build path other than Unity, but guard it the same way
    // for consistency and so a future one isn't silently broken like this
    // was.
    const isUnityDefaultFlow = !commands || engine === 'unity';

    // Note: the equals sign (=) is needed in Powershell.
    // Note: homedir is currently not configured for windows (yet).
    return [
      'docker run `',
      '  --rm `',
      `  --workdir="c:${dockerWorkspacePath}" \``,
      `  ${ImageEnvironmentFactory.getEnvVarString(options, engineEnvVars(options))} \``,
      isUnityDefaultFlow ? `  --env UNITY_SERIAL="${unitySerial}" \`` : '',
      `  --env GITHUB_WORKSPACE=c:${dockerWorkspacePath} \``,
      `  --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \``,
      `  --volume="${currentWorkDir}":"c:${dockerWorkspacePath}" \``,
      isUnityDefaultFlow ? `  --volume="${cliStoragePath}/registry-keys":"c:/registry-keys" \`` : '',
      isUnityDefaultFlow
        ? '  --volume="C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" `'
        : '',
      isUnityDefaultFlow ? '  --volume="C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" `' : '',
      isUnityDefaultFlow
        ? '  --volume="C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" `'
        : '',
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/default-build-script":"c:/UnityBuilderAction" \`` : '',
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/platforms/windows":"c:/steps" \`` : '',
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/BlankProject":"c:/BlankProject" \`` : '',
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/unity-config":"c:/ProgramData/Unity/config" \`` : '',
      `  ${image} \``,
      isUnityDefaultFlow ? '  powershell c:/steps/entrypoint.ps1' : `  ${commands}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}

export { Docker };
