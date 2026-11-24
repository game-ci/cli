import { createRemoteCliCommand, remoteCliCommandNames } from './remote-cli-commands';
import { RemoteClient } from '../model/orchestrator/remote-client';
import { Cli } from '../model/cli/cli';
import Orchestrator from '../model/orchestrator/orchestrator';

describe('remote-cli commands for the game-ci CLI', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Cli.options = undefined;
  });

  it('names the commands the build container runs', () => {
    expect(remoteCliCommandNames).toEqual([
      'remote-cli-pre-build',
      'remote-cli-post-build',
      'remote-cli-log-stream',
      'remote-cli-async-workflow',
    ]);
  });

  it('creates a command for each remote-cli name', () => {
    for (const name of remoteCliCommandNames) {
      expect(createRemoteCliCommand(name)?.name).toBe(name);
    }
  });

  it('creates nothing for other commands', () => {
    expect(createRemoteCliCommand('build')).toBeNull();
  });

  it('passes only its own arguments, so core defaults cannot override the container env', async () => {
    const logStream = vi.spyOn(RemoteClient, 'remoteClientLogStream').mockResolvedValue();
    const command = createRemoteCliCommand('remote-cli-log-stream')!;

    const succeeded = await command.execute({
      _: ['remote-cli-log-stream'],
      $0: 'game-ci',
      logFile: '/home/job-log.txt',
      targetPlatform: 'StandaloneWindows64',
    } as any);

    expect(succeeded).toBe(true);
    expect(logStream).toHaveBeenCalledTimes(1);
    expect(Cli.options).toEqual({ logFile: '/home/job-log.txt', mode: 'cli' });
  });

  // Optional to yargs, like every game-ci CLI option: it parses more than once, and a
  // demanded option fails a later parse. execute() requires it instead.
  it('registers an optional --logFile for remote-cli-log-stream', async () => {
    const registered: Record<string, any> = {};
    const yargs: any = {
      option(name: string, config: any) {
        registered[name] = config;

        return yargs;
      },
    };

    await createRemoteCliCommand('remote-cli-log-stream')!.configureOptions(yargs);

    expect(Object.keys(registered)).toEqual(['logFile']);
    expect(registered.logFile.demandOption).toBe(false);
  });

  it('fails clearly when remote-cli-log-stream gets no --logFile', async () => {
    const logStream = vi.spyOn(RemoteClient, 'remoteClientLogStream').mockResolvedValue();

    await expect(
      createRemoteCliCommand('remote-cli-log-stream')!.execute({
        _: ['remote-cli-log-stream'],
      } as any),
    ).rejects.toThrow('remote-cli-log-stream requires --logFile');
    expect(logStream).not.toHaveBeenCalled();
  });

  // The async container runs on its own task, under the host's build guid: the build
  // it starts needs a guid of its own, as the original async-workflow entry point gave it.
  it("starts a new build from the async container's environment", async () => {
    const saved = { ...process.env };
    process.env.BUILD_GUID = '117-linux64-luxn';
    process.env.TARGET_PLATFORM = 'StandaloneWindows64';
    process.env.UNITY_VERSION = '2022.3.13f1';
    process.env.BRANCH = 'feature/async';
    process.env.GIT_SHA = '0123abc';
    process.env.LOCKED_WORKSPACE = 'retained-workspace-116-linux64-px12';
    process.env.PRE_BUILD_CONTAINER_HOOKS = '- name: warm-up\n  image: ubuntu\n  commands: echo hi';
    const run = vi.spyOn(Orchestrator, 'run').mockResolvedValue({ BuildSucceeded: true } as any);

    try {
      const succeeded = await createRemoteCliCommand('remote-cli-async-workflow')!.execute({
        _: ['remote-cli-async-workflow'],
        targetPlatform: 'StandaloneLinux64',
      } as any);

      const [buildParameters, baseImage] = run.mock.calls[0];
      expect(succeeded).toBe(true);
      expect(buildParameters.targetPlatform).toBe('StandaloneWindows64');
      expect(buildParameters.buildGuid).not.toBe('117-linux64-luxn');
      expect(buildParameters.branch).toBe('feature/async');
      expect(buildParameters.gitSha).toBe('0123abc');
      expect(buildParameters.lockedWorkspace).toBe('');
      expect(buildParameters.preBuildContainerHooks).toBe(process.env.PRE_BUILD_CONTAINER_HOOKS);
      expect(baseImage).toContain('2022.3.13f1');
    } finally {
      process.env = saved;
    }
  });

  it('is offered to the game-ci CLI for any engine', async () => {
    const { default: orchestratorPlugin } = await import('./index');
    const [provider] = orchestratorPlugin.commands;

    expect(provider.engine).toBe('*');
    expect(provider.createCommand('remote-cli-pre-build', [])?.name).toBe('remote-cli-pre-build');
    expect(provider.createCommand('build', [])).toBeNull();
  });
});
