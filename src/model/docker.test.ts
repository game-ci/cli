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
