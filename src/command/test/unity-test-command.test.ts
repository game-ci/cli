import { describe, it, expect, mock, afterEach } from 'bun:test';
import { UnityTestCommand } from './unity-test-command.ts';
import { UnityCliAdapter } from '../../model/unity-cli-adapter.ts';

const originalIsAvailable = UnityCliAdapter.isAvailable;
const originalTest = UnityCliAdapter.test;

afterEach(() => {
  // Both are shared statics — restore them so other test files that
  // exercise the real UnityCliAdapter aren't affected by this file's mocks.
  UnityCliAdapter.isAvailable = originalIsAvailable;
  UnityCliAdapter.test = originalTest;
});

describe('UnityTestCommand', () => {
  it('throws a clear error when the unity CLI binary is unavailable', async () => {
    UnityCliAdapter.isAvailable = mock(() => Promise.resolve(false));

    const command = new UnityTestCommand('test');

    await expect(command.execute({} as any)).rejects.toThrow(/unity.*CLI binary/i);
  });

  it('delegates to UnityCliAdapter.test and returns its success flag', async () => {
    UnityCliAdapter.isAvailable = mock(() => Promise.resolve(true));
    const testMock = mock(() => Promise.resolve({ success: true, output: 'all tests passed' }));
    UnityCliAdapter.test = testMock;

    const command = new UnityTestCommand('test');
    const result = await command.execute({ unityCliArgs: '--platform PlayMode' } as any);

    expect(result).toBe(true);
    expect(testMock).toHaveBeenCalledWith(['--platform', 'PlayMode']);
  });

  it('passes no extra args when unityCliArgs is empty', async () => {
    UnityCliAdapter.isAvailable = mock(() => Promise.resolve(true));
    const testMock = mock(() => Promise.resolve({ success: true, output: '' }));
    UnityCliAdapter.test = testMock;

    const command = new UnityTestCommand('test');
    await command.execute({} as any);

    expect(testMock).toHaveBeenCalledWith([]);
  });

  it('throws a clear error when UnityCliAdapter.test rejects', async () => {
    UnityCliAdapter.isAvailable = mock(() => Promise.resolve(true));
    UnityCliAdapter.test = mock(() => Promise.reject(new Error('unity wrote to stderr')));

    const command = new UnityTestCommand('test');

    await expect(command.execute({} as any)).rejects.toThrow(/test:.*failed.*unity wrote to stderr/);
  });
});
