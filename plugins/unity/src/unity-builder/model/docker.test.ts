import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import * as execModule from '@actions/exec';
import Action from './action';
import Docker from './docker';

describe('Docker', () => {
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

  // game-ci/unity-builder#840: Unity 6.6+ editors request 1GiB of shared
  // memory and hard-fail against Docker's 64m default. This path never passed
  // --shm-size at all, and exposed no input to work around it.
  describe('--shm-size', () => {
    const baseParameters = {
      workspace: '/github/workspace',
      actionFolder: '/action',
      runnerTempPath: Action.rootFolder,
      sshAgent: '',
      sshPublicKeysDirectoryPath: '',
      gitPrivateToken: '',
      dockerWorkspacePath: '/github/workspace',
      dockerCpuLimit: '4',
      dockerMemoryLimit: '8192m',
      dockerIsolationMode: 'default',
    };

    it('passes --shm-size on Linux when dockerShmSize is set', () => {
      const command = Docker.getLinuxCommand('unityci/editor:latest', {
        ...baseParameters,
        dockerShmSize: '1025m',
      } as any);

      expect(command).toContain('--shm-size=1025m');
    });

    it('passes --shm-size on Windows when dockerShmSize is set', () => {
      const command = Docker.getWindowsCommand('unityci/editor:latest', {
        ...baseParameters,
        dockerShmSize: '2g',
      } as any);

      expect(command).toContain('--shm-size=2g');
    });

    it('omits --shm-size when explicitly disabled with "0"', () => {
      const command = Docker.getLinuxCommand('unityci/editor:latest', {
        ...baseParameters,
        dockerShmSize: '0',
      } as any);

      expect(command).not.toContain('--shm-size');
    });

    it('omits --shm-size when unset, rather than emitting "--shm-size=undefined"', () => {
      const command = Docker.getLinuxCommand('unityci/editor:latest', baseParameters as any);

      expect(command).not.toContain('--shm-size');
    });
  });

  describe('resolveBuildPlatform', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('honors an explicit "linux" override without touching Docker', async () => {
      const spy = vi.spyOn(execModule, 'getExecOutput');

      expect(await Docker.resolveBuildPlatform('linux')).toBe('linux');
      expect(spy).not.toHaveBeenCalled();
    });

    it('honors an explicit "windows" override without touching Docker', async () => {
      const spy = vi.spyOn(execModule, 'getExecOutput');

      expect(await Docker.resolveBuildPlatform('windows')).toBe('win32');
      expect(spy).not.toHaveBeenCalled();
    });

    it('"auto" trusts the Docker daemon OS over the host OS - Windows host, Linux containers', async () => {
      vi.spyOn(execModule, 'getExecOutput').mockResolvedValue({
        stdout: 'linux\n',
        stderr: '',
        exitCode: 0,
      });

      expect(await Docker.resolveBuildPlatform('auto')).toBe('linux');
    });

    it('"auto" trusts the Docker daemon OS over the host OS - Linux host, Windows containers', async () => {
      vi.spyOn(execModule, 'getExecOutput').mockResolvedValue({
        stdout: 'windows\n',
        stderr: '',
        exitCode: 0,
      });

      expect(await Docker.resolveBuildPlatform('auto')).toBe('win32');
    });

    it('"auto" falls back to the host OS when Docker is unreachable', async () => {
      vi.spyOn(execModule, 'getExecOutput').mockRejectedValue(new Error('docker: command not found'));

      expect(await Docker.resolveBuildPlatform('auto')).toBe(process.platform);
    });
  });

  describe('run pull behavior', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('pulls the image explicitly before running, so pull time is not folded into the license-hold window', async () => {
      const execSpy = vi.spyOn(execModule, 'exec').mockResolvedValue(0);

      const parameters = {
        workspace: Action.rootFolder,
        actionFolder: Action.actionFolder,
        runnerTempPath: '/tmp',
        dockerCpuLimit: '2',
        dockerMemoryLimit: '4g',
        dockerWorkspacePath: '/github/workspace',
        buildPlatform: 'linux',
      } as any;

      await Docker.run('unityci/editor:some-tag', parameters);

      expect(execSpy).toHaveBeenNthCalledWith(1, 'docker', ['pull', 'unityci/editor:some-tag']);
    });

    it('does not attempt to run if the pull itself fails - a pull failure is not launch-retryable', async () => {
      const execSpy = vi.spyOn(execModule, 'exec').mockRejectedValueOnce(new Error('manifest unknown'));

      const parameters = {
        workspace: Action.rootFolder,
        actionFolder: Action.actionFolder,
        runnerTempPath: '/tmp',
        dockerCpuLimit: '2',
        dockerMemoryLimit: '4g',
        dockerWorkspacePath: '/github/workspace',
        buildPlatform: 'linux',
      } as any;

      await expect(Docker.run('some-image', parameters)).rejects.toThrow('manifest unknown');

      expect(execSpy).toHaveBeenCalledTimes(1);
    });
  });
});
