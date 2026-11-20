import BuildParameters from './build-parameters';
import { Cli } from './cli/cli';
import Orchestrator from './orchestrator/orchestrator';

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

describe('BuildParameters.shouldUseRetainedWorkspaceMode', () => {
  afterEach(() => {
    Orchestrator.buildParameters = undefined as any;
  });

  // The orchestrator records the workspace it locked; retained-workspace mode
  // (keeping the workspace, then releasing its lock) has to see that.
  it('is on once the orchestrator has locked a workspace', () => {
    const buildParameters = new BuildParameters();
    buildParameters.maxRetainedWorkspaces = 1;
    buildParameters.lockedWorkspace = '';
    Orchestrator.buildParameters = buildParameters;

    expect(BuildParameters.shouldUseRetainedWorkspaceMode(buildParameters)).toBe(false);

    Orchestrator.lockedWorkspace = 'retained-workspace-1-linux64-abcd';

    expect(BuildParameters.shouldUseRetainedWorkspaceMode(buildParameters)).toBe(true);
    expect(Orchestrator.lockedWorkspace).toBe('retained-workspace-1-linux64-abcd');

    Orchestrator.lockedWorkspace = '';

    expect(BuildParameters.shouldUseRetainedWorkspaceMode(buildParameters)).toBe(false);
  });
});
