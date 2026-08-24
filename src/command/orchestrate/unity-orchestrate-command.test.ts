import { describe, it, expect, mock, afterEach } from 'bun:test';
import { UnityOrchestrateCommand } from './unity-orchestrate-command.ts';
import { Orchestrator } from '../../../plugins/orchestrator/src/model/index.ts';

const originalOrchestratorRun = Orchestrator.run;

afterEach(() => {
  // Orchestrator.run is a shared static — restore it so other test files
  // exercising the real implementation aren't affected by this file's mocks.
  Orchestrator.run = originalOrchestratorRun;
});

describe('UnityOrchestrateCommand', () => {
  it('returns true when the orchestrated build succeeds', async () => {
    const buildParameters = { providerStrategy: 'local-docker' } as any;
    const runMock = mock(() =>
      Promise.resolve({
        BuildParameters: buildParameters,
        BuildResults: 'ok',
        BuildSucceeded: true,
        BuildFinished: true,
        LibraryCacheUsed: false,
      }),
    );
    Orchestrator.run = runMock;

    const command = new UnityOrchestrateCommand('orchestrate');
    const result = await command.execute({ providerStrategy: 'local-docker', projectPath: '.' } as any);

    expect(result).toBe(true);
    expect(runMock).toHaveBeenCalled();
  });

  it('returns false when the orchestrated build fails', async () => {
    const buildParameters = { providerStrategy: 'local-docker' } as any;
    const runMock = mock(() =>
      Promise.resolve({
        BuildParameters: buildParameters,
        BuildResults: 'failed',
        BuildSucceeded: false,
        BuildFinished: true,
        LibraryCacheUsed: false,
      }),
    );
    Orchestrator.run = runMock;

    const command = new UnityOrchestrateCommand('orchestrate');
    const result = await command.execute({ providerStrategy: 'local-docker', projectPath: '.' } as any);

    expect(result).toBe(false);
  });

  it('builds BuildParameters from the CLI options and passes them, with an ImageTag string, to Orchestrator.run', async () => {
    const runMock = mock(() =>
      Promise.resolve({
        BuildParameters: {},
        BuildResults: '',
        BuildSucceeded: true,
        BuildFinished: true,
        LibraryCacheUsed: false,
      }),
    );
    Orchestrator.run = runMock;

    const command = new UnityOrchestrateCommand('orchestrate');
    await command.execute({
      providerStrategy: 'local',
      projectPath: '.',
      engineVersion: '2022.3.20f1',
      targetPlatform: 'StandaloneLinux64',
    } as any);

    expect(runMock).toHaveBeenCalledTimes(1);
    const [buildParametersArg, baseImageArg] = runMock.mock.calls[0];
    expect(buildParametersArg.providerStrategy).toBe('local');
    expect(buildParametersArg.editorVersion).toBe('2022.3.20f1');
    expect(typeof baseImageArg).toBe('string');
  });

  describe('configureOptions', () => {
    // Regression test for a real bug: configureOptions previously only
    // registered ProjectOptions + RemoteOptions, so under yargs' global
    // strict(true) mode, `game-ci orchestrate --targetPlatform=...` failed
    // with "Unknown argument: targetPlatform" before ever reaching
    // createBuildParametersFromCliOptions, which reads that field (and
    // buildName/buildsPath/buildMethod/etc.) unconditionally. This made
    // `orchestrate` impossible to invoke for a concrete build target via
    // its own documented flags - confirmed live, not just in theory: the
    // exact command above returned exit 1 with that error before this fix.
    it('registers targetPlatform and the other build-identification options build-parameters-adapter reads', async () => {
      const registered: Record<string, any> = {};
      const mockYargs: any = {
        option(name: string, config: any) {
          registered[name] = config;

          return mockYargs;
        },
      };

      const command = new UnityOrchestrateCommand('orchestrate');
      await command.configureOptions(mockYargs);

      for (const name of [
        'targetPlatform',
        'buildName',
        'buildsPath',
        'buildMethod',
        'buildProfile',
        'buildVersion',
        'androidVersionCode',
        'manualExit',
        'enableGpu',
        'allowDirtyBuild',
        'cacheUnityInstallationOnMac',
        'chownFilesTo',
        'sshAgent',
        'sshPublicKeysDirectoryPath',
        'gitPrivateToken',
      ]) {
        expect(registered).toHaveProperty(name);
      }
    });
  });
});
