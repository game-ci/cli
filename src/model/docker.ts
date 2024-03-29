import ImageEnvironmentFactory from './image-environment-factory.ts';
import { path, fsSync as fs, Options } from '../dependencies.ts';
import System from './system/system.ts';
import UnityBuildValidation from "./unity/build-validation/unity-build-validation.ts";

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

      switch (engine)
      {
        case 'unity':
          UnityBuildValidation.validateBuild(dockerRun.output);
          break;
      }

    } catch (error) {
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
    const { currentWorkDir, homeDir, cliDistPath, runnerTempPath, sshAgent, gitPrivateToken, dockerWorkspacePath } = options;

    const home = homeDir;

    // Todo - test on GitHub
    // const home = path.join(runnerTempPath, '_github_home');
    // await fs.ensureDir(home);

    // const githubWorkflow = path.join(runnerTempPath, '_github_workflow');
    // await fs.ensureDir(githubWorkflow);

    return (
      String.dedent`
      docker run \
        --rm \
        --workdir ${dockerWorkspacePath} \
        ${ImageEnvironmentFactory.getEnvVarString(options)} \
        --env UNITY_SERIAL \
        --env GITHUB_WORKSPACE=${dockerWorkspacePath} \
        ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
        ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
        --volume "${home}":"/root:z" \
       ` +
      // Todo - do we really need to pass this into the image???
      // --volume "${githubWorkflow}":"/github/workflow:z" \
      `
        --volume "${currentWorkDir}":"${dockerWorkspacePath}:z" \
        --volume "${cliDistPath}/default-build-script:/UnityBuilderAction:z" \
        --volume "${cliDistPath}/platforms/ubuntu/steps:/steps:z" \
        --volume "${cliDistPath}/platforms/ubuntu/entrypoint.sh:/entrypoint.sh:z" \
        --volume "${cliDistPath}/unity-config:/usr/share/unity3d/config:z" \
        ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
        ${sshAgent ? '--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro' : ''} \
        ${image} \
        /bin/bash -c /entrypoint.sh
    `
    );
  }

  private static getWindowsCommand(image: string, options: Options): string {
    const { currentWorkDir, homeDir, cliDistPath, unitySerial, gitPrivateToken, cliStoragePath, dockerWorkspacePath } = options;

    // Note: the equals sign (=) is needed in Powershell.
    // Note: homedir is currently not configured for windows (yet).
    return String.dedent`
      docker run \`
        --rm \`
        --workdir="c:${dockerWorkspacePath}" \`
        ${ImageEnvironmentFactory.getEnvVarString(options)} \`
        --env UNITY_SERIAL="${unitySerial}" \`
        --env GITHUB_WORKSPACE=c:${dockerWorkspacePath} \`
        --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \`
        --volume="${currentWorkDir}":"c:${dockerWorkspacePath}" \`
        --volume="${cliStoragePath}/registry-keys":"c:/registry-keys" \`
        --volume="C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \`
        --volume="C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \`
        --volume="C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" \`
        --volume="${cliDistPath}/default-build-script":"c:/UnityBuilderAction" \`
        --volume="${cliDistPath}/platforms/windows":"c:/steps" \`
        --volume="${cliDistPath}/BlankProject":"c:/BlankProject" \`
        --volume="${cliDistPath}/unity-config":"c:/ProgramData/Unity/config" \`
        ${image} \`
        powershell c:/steps/entrypoint.ps1
    `;
  }
}

export default Docker;
