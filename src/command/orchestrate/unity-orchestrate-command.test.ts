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
});
