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
});
