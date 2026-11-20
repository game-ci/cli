import { prepareRemoteBuild } from '../remote-build-context';
import { Cli } from '../../model/cli/cli';
import Orchestrator from '../../model/orchestrator/orchestrator';

describe('prepareRemoteBuild', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.spyOn(Orchestrator, 'setup').mockImplementation(async (buildParameters) => {
      Orchestrator.buildParameters = buildParameters;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Cli.options = undefined;
    Orchestrator.buildParameters = undefined as any;
    process.env = { ...saved };
  });

  // The host serialises its build into the container's environment; a remote
  // build has to continue that build, not start a new one.
  it("continues the host's build from the container's environment", async () => {
    process.env.BUILD_GUID = '117-linux64-luxn';
    process.env.CACHE_KEY = 'test-case-1';
    process.env.LOCKED_WORKSPACE = 'retained-workspace-116-linux64-px12';
    process.env.MAX_RETAINED_WORKSPACES = '1';

    await prepareRemoteBuild({});

    expect(Orchestrator.setup).toHaveBeenCalledTimes(1);
    expect(Orchestrator.buildParameters.buildGuid).toBe('117-linux64-luxn');
    expect(Orchestrator.buildParameters.cacheKey).toBe('test-case-1');
    expect(Orchestrator.lockedWorkspace).toBe('retained-workspace-116-linux64-px12');
  });

  it('leaves the workspace unlocked when the host locked none', async () => {
    process.env.BUILD_GUID = '117-linux64-luxn';
    delete process.env.LOCKED_WORKSPACE;

    await prepareRemoteBuild({});

    expect(Orchestrator.lockedWorkspace).toBe('');
  });
});
