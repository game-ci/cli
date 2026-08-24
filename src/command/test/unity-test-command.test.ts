import { describe, it, expect, mock, afterEach } from 'bun:test';
import { UnityTestCommand } from './unity-test-command.ts';
import { UnityCliAdapter } from '../../model/unity-cli-adapter.ts';
import { Docker } from '../../model/index.ts';
import { HostRunner } from '../../model/host-runner.ts';
import { PlatformSetup } from '../../logic/unity/platform-setup/index.ts';

const originalIsAvailable = UnityCliAdapter.isAvailable;
const originalTest = UnityCliAdapter.test;
const originalDockerRun = Docker.run;
const originalHostRunnerRun = HostRunner.run;
const originalPlatformSetup = PlatformSetup.setup;

afterEach(() => {
  // All statics — restore them so other test files that exercise the real
  // implementations aren't affected by this file's mocks.
  UnityCliAdapter.isAvailable = originalIsAvailable;
  UnityCliAdapter.test = originalTest;
  Docker.run = originalDockerRun;
  HostRunner.run = originalHostRunnerRun;
  PlatformSetup.setup = originalPlatformSetup;
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

  it('--docker runs the classic batchmode flow via Docker.run, not the unity CLI', async () => {
    const isAvailableMock = mock(() => Promise.resolve(true));
    UnityCliAdapter.isAvailable = isAvailableMock;
    PlatformSetup.setup = mock(() => Promise.resolve());
    const dockerRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;

    const command = new UnityTestCommand('test');
    const result = await command.execute({
      docker: true,
      hostPlatform: 'linux',
      engineVersion: '2022.3.20f1',
    } as any);

    expect(result).toBe(true);
    expect(isAvailableMock).not.toHaveBeenCalled();
    expect(dockerRunMock).toHaveBeenCalledTimes(1);
    const [image, options] = dockerRunMock.mock.calls[0] as unknown as [string, any];
    // Defaults to this host's native Standalone target (StandaloneLinux64 on
    // Linux), which resolves to the linux-il2cpp module for Unity 2020+ -
    // NOT the 'base'/NoTarget image, which lacks what's needed to actually
    // compile and run test assemblies (see defaultTestTargetPlatform).
    expect(image).toContain('linux-il2cpp');
    expect(options.runTests).toBe(true);
  });

  it('--docker --local runs directly on the host via HostRunner.run, not Docker', async () => {
    const dockerRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;
    const hostRunnerMock = mock(() => Promise.resolve());
    HostRunner.run = hostRunnerMock;

    const command = new UnityTestCommand('test');
    const result = await command.execute({ docker: true, local: true, hostPlatform: 'linux' } as any);

    expect(result).toBe(true);
    expect(dockerRunMock).not.toHaveBeenCalled();
    expect(hostRunnerMock).toHaveBeenCalledTimes(1);
    const [options] = hostRunnerMock.mock.calls[0] as unknown as [any];
    expect(options.runTests).toBe(true);
  });

  it('--docker on macOS throws instead of trying to pull a nonexistent macOS editor image', async () => {
    PlatformSetup.setup = mock(() => Promise.resolve());

    const command = new UnityTestCommand('test');

    await expect(
      command.execute({ docker: true, hostPlatform: 'darwin', engineVersion: '2022.3.20f1' } as any),
    ).rejects.toThrow(/macOS/i);
  });

  // Windows Docker test runs used to be rejected outright, because the
  // container entrypoint.ps1 had no RUN_TESTS branch and would silently run
  // a BUILD instead. It has one now (reusing the shared steps/test.ps1), so
  // the flow is allowed through the same way Linux is.
  it('--docker on Windows runs the batchmode flow instead of being rejected', async () => {
    PlatformSetup.setup = mock(() => Promise.resolve());
    const dockerRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;

    const command = new UnityTestCommand('test');
    const result = await command.execute({
      docker: true,
      hostPlatform: 'win32',
      hostOS: 'windows',
      engineVersion: '2022.3.20f1',
    } as any);

    expect(result).toBe(true);
    expect(dockerRunMock).toHaveBeenCalledTimes(1);
    const [image, options] = dockerRunMock.mock.calls[0] as unknown as [string, any];
    // Windows' own native Standalone target, which can only resolve to the
    // windows-il2cpp module (see RunnerImageTag) - never the Linux one.
    expect(image).toContain('windows-il2cpp');
    expect(options.runTests).toBe(true);
  });
});
