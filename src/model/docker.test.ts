import { Action } from './action.ts';
import { Docker } from './docker.ts';

describe('Docker', () => {
  it('builds a continuous Linux docker command', () => {
    const command = (Docker as any).getLinuxCommand('game-ci/unity-editor-stub:latest', {
      hostOS: 'linux',
      currentWorkDir: '/home/runner/work/cli/cli',
      homeDir: '/home/runner',
      cliDistPath: '/home/runner/work/cli/cli/dist',
      runnerTempPath: '/home/runner/work/_temp',
      sshAgent: '',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      engine: 'unity',
      unityLicense: 'ci-stub-license',
      engineVersion: '2019.4.40f1',
      projectPath: 'test-project',
      targetPlatform: 'StandaloneLinux64',
      buildName: 'StandaloneLinux64',
      buildPath: 'build/StandaloneLinux64',
      buildFile: 'StandaloneLinux64',
    });

    expect(command).toContain('--env UNITY_LICENSE="ci-stub-license"');
    expect(command).toContain('--volume "/home/runner":"/root:z"');
    expect(command).toContain('--volume "/home/runner/work/cli/cli":"/github/workspace:z"');
    expect(command).toContain('game-ci/unity-editor-stub:latest');
    expect(command).toContain('/bin/bash /entrypoint.sh');
    expect(command).not.toContain('\n');
  });

  it('uses the engine-supplied commands instead of the Unity entrypoint for non-Unity engines', () => {
    const command = (Docker as any).getLinuxCommand('game-ci/godot:latest', {
      hostOS: 'linux',
      currentWorkDir: '/home/runner/work/cli/cli',
      homeDir: '/home/runner',
      cliDistPath: '/home/runner/work/cli/cli/dist',
      runnerTempPath: '/home/runner/work/_temp',
      sshAgent: '',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      engine: 'godot',
      projectPath: 'test-project',
      commands: 'godot --headless --export-release "Linux" build/output',
    });

    expect(command).toContain('godot --headless --export-release "Linux" build/output');
    expect(command).not.toContain('/bin/bash /entrypoint.sh');
    expect(command).not.toContain('--env UNITY_SERIAL');
    expect(command).not.toContain('entrypoint.sh:/entrypoint.sh');
  });

  it('still uses the Unity entrypoint when engine is unity even if commands happens to be set', () => {
    const command = (Docker as any).getLinuxCommand('game-ci/unity-editor-stub:latest', {
      hostOS: 'linux',
      currentWorkDir: '/home/runner/work/cli/cli',
      homeDir: '/home/runner',
      cliDistPath: '/home/runner/work/cli/cli/dist',
      runnerTempPath: '/home/runner/work/_temp',
      sshAgent: '',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      engine: 'unity',
      commands: 'should-not-be-used',
    });

    expect(command).toContain('/bin/bash /entrypoint.sh');
    expect(command).not.toContain('should-not-be-used');
  });

  it('applies docker resource limits and host networking when set', () => {
    const command = (Docker as any).getLinuxCommand('game-ci/unity-editor-stub:latest', {
      hostOS: 'linux',
      currentWorkDir: '/home/runner/work/cli/cli',
      homeDir: '/home/runner',
      cliDistPath: '/home/runner/work/cli/cli/dist',
      sshAgent: '',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      engine: 'unity',
      dockerCpuLimit: '4',
      dockerMemoryLimit: '8192m',
      useHostNetwork: true,
    });

    expect(command).toContain('--cpus=4');
    expect(command).toContain('--memory=8192m');
    expect(command).toContain('--net=host');
  });

  it('mounts a custom SSH public keys directory instead of the known_hosts fallback', () => {
    const command = (Docker as any).getLinuxCommand('game-ci/unity-editor-stub:latest', {
      hostOS: 'linux',
      currentWorkDir: '/home/runner/work/cli/cli',
      homeDir: '/home/runner',
      cliDistPath: '/home/runner/work/cli/cli/dist',
      sshAgent: '/ssh-agent',
      sshPublicKeysDirectoryPath: '/home/runner/.ssh/keys',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      engine: 'unity',
    });

    expect(command).toContain('--volume /home/runner/.ssh/keys:/root/.ssh:ro');
    expect(command).not.toContain('known_hosts');
  });

  it('mounts sshPublicKeysDirectoryPath even without sshAgent set, matching unity-builder', () => {
    const command = (Docker as any).getLinuxCommand('game-ci/unity-editor-stub:latest', {
      hostOS: 'linux',
      currentWorkDir: '/home/runner/work/cli/cli',
      homeDir: '/home/runner',
      cliDistPath: '/home/runner/work/cli/cli/dist',
      sshAgent: '',
      sshPublicKeysDirectoryPath: '/home/runner/.ssh/keys',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      engine: 'unity',
    });

    expect(command).toContain('--volume /home/runner/.ssh/keys:/root/.ssh:ro');
  });

  it('applies docker resource limits and isolation mode on Windows', () => {
    const command = (Docker as any).getWindowsCommand('game-ci/unity-editor-stub:latest', {
      currentWorkDir: 'C:/work/cli',
      homeDir: 'C:/Users/runner',
      cliDistPath: 'C:/work/cli/dist',
      cliStoragePath: 'C:/work/.game-ci',
      unitySerial: '',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      engine: 'unity',
      dockerCpuLimit: '4',
      dockerMemoryLimit: '8192m',
      dockerIsolationMode: 'process',
    });

    expect(command).toContain('--cpus=4');
    expect(command).toContain('--memory=8192m');
    expect(command).toContain('--isolation=process');
  });

  it.skip('runs', async () => {
    const image = 'unity-builder:2019.2.11f1-webgl';
    const parameters = {
      workspace: Action.rootFolder,
      projectPath: `${Action.rootFolder}/test-project`,
      buildName: 'someBuildName',
      buildsPath: 'build',
      method: '',
    };
    await Docker.run(image, parameters);
  });
});
