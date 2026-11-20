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

describe('BuildParameters.create in a remote build container', () => {
  const saved = { ...process.env };

  afterEach(() => {
    Cli.options = undefined;
    process.env = { ...saved };
  });

  // The host serialises these into the container's environment.
  it("reads the orchestrator's parameters from the environment, typed", async () => {
    Cli.options = { mode: 'cli', versioning: 'None' };
    process.env.CACHE_KEY = 'test-case-1';
    process.env.USE_LARGE_PACKAGES = 'true';
    process.env.CLONE_DEPTH = '10';
    process.env.GARBAGE_MAX_AGE = '6';
    process.env.CONTAINER_NAMESPACE = 'ci';

    const buildParameters = await BuildParameters.create();

    expect(buildParameters.cacheKey).toBe('test-case-1');
    expect(buildParameters.useLargePackages).toBe(true);
    expect(buildParameters.cloneDepth).toBe(10);
    expect(buildParameters.garbageMaxAge).toBe(6);
    expect(buildParameters.containerNamespace).toBe('ci');
  });

  it('still lets CLI options win', async () => {
    Cli.options = { mode: 'cli', versioning: 'None', cacheKey: 'from-cli' };
    process.env.CACHE_KEY = 'from-env';

    expect((await BuildParameters.create()).cacheKey).toBe('from-cli');
  });
});
