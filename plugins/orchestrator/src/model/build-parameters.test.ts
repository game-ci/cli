import BuildParameters from './build-parameters';
import { Cli } from './cli/cli';

describe('BuildParameters.create', () => {
  afterEach(() => {
    Cli.options = undefined;
  });

  // Retained workspaces and locks are named after the build guid, so an empty
  // one made every build claim the same workspace ("retained-workspace- already exists").
  it('gives every build its own guid, from the run number and target platform', async () => {
    Cli.options = {
      mode: 'cli',
      runNumber: '42',
      targetPlatform: 'StandaloneLinux64',
      projectPath: 'test-project',
      versioning: 'None',
    };

    const first = await BuildParameters.create();
    const second = await BuildParameters.create();

    expect(first.buildGuid).toMatch(/^42-linux64-[\da-z]{4}$/);
    expect(second.buildGuid).not.toBe(first.buildGuid);
  });
});
