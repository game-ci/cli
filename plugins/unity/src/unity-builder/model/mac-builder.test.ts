import { describe, it, expect, afterEach, vi } from 'vitest';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import MacBuilder from './mac-builder';

vi.spyOn(core, 'warning').mockImplementation(() => {});
const execSpy = vi.spyOn(exec, 'exec');

vi.useFakeTimers();

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

function mockRun(exitCode: number, output: string) {
  return async (
    _command: string,
    _args: string[] | undefined,
    options: exec.ExecOptions | undefined,
  ) => {
    options?.listeners?.stdout?.(Buffer.from(output));
    return exitCode;
  };
}

describe('MacBuilder', () => {
  it('returns 0 immediately on success without retrying', async () => {
    execSpy.mockImplementationOnce(mockRun(0, 'Build succeeded'));

    await expect(MacBuilder.run('/action')).resolves.toBe(0);
    expect(execSpy).toHaveBeenCalledTimes(1);
  });

  it('returns a real failure immediately, without retrying', async () => {
    execSpy.mockImplementationOnce(mockRun(1, 'Some unrelated compile error'));

    await expect(MacBuilder.run('/action')).resolves.toBe(1);
    expect(execSpy).toHaveBeenCalledTimes(1);
  });

  it('retries on the transient Licensing Client signature error, then succeeds', async () => {
    execSpy
      .mockImplementationOnce(
        mockRun(1, 'Error: Code 10 while verifying Licensing Client signature (process Id: 1)'),
      )
      .mockImplementationOnce(mockRun(0, 'Build succeeded'));

    const runPromise = MacBuilder.run('/action');
    await vi.runAllTimersAsync();

    await expect(runPromise).resolves.toBe(0);
    expect(execSpy).toHaveBeenCalledTimes(2);
  });

  it('gives up after the max attempts and returns the last failing exit code', async () => {
    execSpy.mockImplementation(
      mockRun(1, 'Error: Code 10 while verifying Licensing Client signature (process Id: 1)'),
    );

    const runPromise = MacBuilder.run('/action');
    await vi.runAllTimersAsync();

    await expect(runPromise).resolves.toBe(1);
    expect(execSpy).toHaveBeenCalledTimes(3);
  });
});
