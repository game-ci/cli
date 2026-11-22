import { prepareRemoteBuild } from '../remote-build-context';
import { Cli } from '../../model/cli/cli';
import Orchestrator from '../../model/orchestrator/orchestrator';
import { createBuildParametersFromCliOptions } from '../../cli-plugin/build-parameters-adapter';
import { TaskParameterSerializer } from '../../model/orchestrator/services/core/task-parameter-serializer';

// A host build with a distinct value in every field it can send: hooks, steps and the
// engine need values that parse, so they keep their defaults.
function hostBuildWithDistinctValues() {
  const host: Record<string, unknown> = createBuildParametersFromCliOptions({});
  for (const [key, value] of Object.entries(host)) {
    if (/hook|steps|customJob|engine|isCliMode/i.test(key)) continue;
    if (typeof value === 'string') host[key] = `host-${key}`;
    if (typeof value === 'boolean') host[key] = !value;
    if (typeof value === 'number') host[key] = value + 7;
  }

  return host;
}

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

  // The container must build what the host asked for: the branch and commit, the sync
  // strategy, the LFS and submodule settings. It has only the environment to go on.
  it('receives every build parameter the host sends', async () => {
    const host = hostBuildWithDistinctValues();
    const sent = TaskParameterSerializer.createOrchestratorEnvironmentVariables(host as any);
    for (const { name, value } of sent) process.env[name] = value;

    await prepareRemoteBuild({});

    const container = Orchestrator.buildParameters as unknown as Record<string, unknown>;
    const sentValues = new Map(sent.map(({ name, value }) => [name, value]));
    const lost = Object.keys(host)
      .filter((key) => typeof host[key] !== 'object' && key !== 'isCliMode')
      .map((key) => [key, sentValues.get(TaskParameterSerializer.ToEnvVarFormat(key))] as const)
      .filter(([key, value]) => value !== undefined && String(container[key]) !== value)
      .map(([key, value]) => `${key}: sent ${value}, got ${JSON.stringify(container[key])}`);
    expect(lost).toEqual([]);
    expect(container.branch).toBe('host-branch');
    expect(container.gitSha).toBe('host-gitSha');
    expect(container.skipLfs).toBe(host.skipLfs);
    expect(container.cacheRetentionDays).toBe(host.cacheRetentionDays);
  });

  // Fields the CLI option mapping leaves unset have no typed default to read the
  // host's value back as; BuildParameters.create() already reads them, typed.
  it('keeps the type of fields the option mapping leaves unset', async () => {
    process.env.MAX_CACHE_ENTRIES = '3';
    process.env.CONFIG_FILES = '{"ProjectSettings/a.asset":"b"}';

    await prepareRemoteBuild({});

    expect(Orchestrator.buildParameters.maxCacheEntries).toBe(3);
    expect(Orchestrator.buildParameters.configFiles).toEqual({ 'ProjectSettings/a.asset': 'b' });
  });

  it('keeps the container hooks the host configured', async () => {
    process.env.PRE_BUILD_CONTAINER_HOOKS = '- name: warm-up\n  image: ubuntu\n  commands: echo hi';
    process.env.POST_BUILD_CONTAINER_HOOKS =
      '- name: report\n  image: ubuntu\n  commands: echo bye';

    await prepareRemoteBuild({});

    expect(Orchestrator.buildParameters.preBuildContainerHooks).toBe(
      process.env.PRE_BUILD_CONTAINER_HOOKS,
    );
    expect(Orchestrator.buildParameters.postBuildContainerHooks).toBe(
      process.env.POST_BUILD_CONTAINER_HOOKS,
    );
  });

  it('stays in CLI mode, whatever the host ran in', async () => {
    process.env.IS_CLI_MODE = 'false';

    await prepareRemoteBuild({});

    expect(Orchestrator.buildParameters.isCliMode).toBe(true);
  });

  it('leaves the workspace unlocked when the host locked none', async () => {
    process.env.BUILD_GUID = '117-linux64-luxn';
    delete process.env.LOCKED_WORKSPACE;

    await prepareRemoteBuild({});

    expect(Orchestrator.lockedWorkspace).toBe('');
  });
});
