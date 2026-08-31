import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import * as execModule from '@actions/exec';
import Action from './action';
import Docker from './docker';
import ImageTag from './image-tag';

describe('Docker', () => {
  describe('run pull behavior', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('pulls the image explicitly before running, so pull time is not folded into the license-hold window', async () => {
      const execSpy = vi.spyOn(execModule, 'exec').mockResolvedValue(0);

      const parameters = {
        unityVersion: '2019.2.11f1',
        workspace: Action.rootFolder,
      } as any;

      await Docker.run('unityci/editor:some-tag', parameters);

      expect(execSpy).toHaveBeenNthCalledWith(1, 'docker', ['pull', 'unityci/editor:some-tag']);
    });

    it('does not attempt to run if the pull itself fails - a pull failure is not launch-retryable', async () => {
      const execSpy = vi.spyOn(execModule, 'exec').mockRejectedValueOnce(new Error('manifest unknown'));

      const parameters = {
        unityVersion: '2019.2.11f1',
        workspace: Action.rootFolder,
      } as any;

      await expect(Docker.run('some-image', parameters)).rejects.toThrow('manifest unknown');

      expect(execSpy).toHaveBeenCalledTimes(1);
    });
  });

  it.skip('builds', async () => {
    const path = Action.actionFolder;
    const dockerfile = `${path}/Dockerfile`;
    const baseImage = new ImageTag('2019.2.11f1');
    const tag = await Docker.build({ path, dockerfile, baseImage }, true);
    expect(tag).toBeInstanceOf(ImageTag);
    expect(tag.toString()).toStrictEqual('unity-builder:3');
  }, 240_000);
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
