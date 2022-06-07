import Action from './action.ts';
import Docker from './docker.ts';

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
});
