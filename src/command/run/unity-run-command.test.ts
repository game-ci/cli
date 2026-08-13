import { describe, it, expect, mock } from 'bun:test';
import { UnityRunCommand } from './unity-run-command.ts';
import { UnityCliAdapter } from '../../model/unity-cli-adapter.ts';

describe('UnityRunCommand', () => {
  it('throws a clear error when the unity CLI binary is unavailable', async () => {
    const isAvailable = mock(() => Promise.resolve(false));
    UnityCliAdapter.isAvailable = isAvailable;

    const command = new UnityRunCommand('run');

    await expect(command.execute({ command: 'MyNamespace.MyClass.MyMethod' } as any)).rejects.toThrow(
      /unity.*CLI binary/i,
    );
  });

  it('delegates to UnityCliAdapter.runCommand and returns its success flag', async () => {
    UnityCliAdapter.isAvailable = mock(() => Promise.resolve(true));
    const runCommand = mock(() => Promise.resolve({ success: true, output: 'done' }));
    UnityCliAdapter.runCommand = runCommand;

    const command = new UnityRunCommand('run');
    const result = await command.execute({
      command: 'MyNamespace.MyClass.MyMethod',
      unityCliArgs: '--flag value',
    } as any);

    expect(result).toBe(true);
    expect(runCommand).toHaveBeenCalledWith('MyNamespace.MyClass.MyMethod', ['--flag', 'value']);
  });

  it('throws a clear error when UnityCliAdapter.runCommand rejects', async () => {
    UnityCliAdapter.isAvailable = mock(() => Promise.resolve(true));
    UnityCliAdapter.runCommand = mock(() => Promise.reject(new Error('unity wrote to stderr')));

    const command = new UnityRunCommand('run');

    await expect(
      command.execute({ command: 'MyNamespace.MyClass.MyMethod' } as any),
    ).rejects.toThrow(/run:.*MyNamespace\.MyClass\.MyMethod.*failed.*unity wrote to stderr/);
  });
});
