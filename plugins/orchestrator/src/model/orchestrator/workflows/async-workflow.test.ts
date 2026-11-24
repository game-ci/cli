import { afterEach, describe, expect, it, vi } from 'vitest';
import BuildParameters from '../../build-parameters';
import Orchestrator from '../orchestrator';
import { AsyncWorkflow } from './async-workflow';

describe('AsyncWorkflow', () => {
  afterEach(() => {
    Orchestrator.buildParameters = undefined as any;
    Orchestrator.Provider = undefined as any;
  });

  // The container runs game-ci/cli's dist/index.js, whose strict yargs parser
  // rejects the retired `-m <name>` dispatch as an unknown argument.
  it('starts the build in its container with a game-ci CLI command', async () => {
    const runTaskInWorkflow = vi.fn(async () => 'async output');
    Orchestrator.Provider = { runTaskInWorkflow } as any;
    Orchestrator.buildParameters = Object.assign(new BuildParameters(), {
      buildGuid: '117-linux64-luxn',
      branch: 'main',
    });

    const output = await AsyncWorkflow.runAsyncWorkflow([], []);

    const [, , commands, , , environment] = runTaskInWorkflow.mock.calls[0] as any[];
    expect(output).toBe('async output');
    expect(commands).toContain('node /builder/dist/index.js remote-cli-async-workflow');
    expect(commands).not.toContain(' -m ');
    expect(environment).toContainEqual(
      expect.objectContaining({ name: 'ASYNC_WORKFLOW', value: 'true' }),
    );
  });
});
