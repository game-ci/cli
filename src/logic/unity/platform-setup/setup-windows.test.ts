import { describe, it, expect, mock, afterEach } from 'bun:test';
import { SetupWindows } from './setup-windows.ts';
import { fsSync as fs } from '../../../dependencies.ts';
import { System } from '../../../model/system/system.ts';
import { ValidateWindows } from '../platform-validation/validate-windows.ts';

const originalEnsureDir = fs.ensureDir;
const originalSystemRun = System.run;
const originalValidate = ValidateWindows.validate;

afterEach(() => {
  fs.ensureDir = originalEnsureDir;
  System.run = originalSystemRun;
  ValidateWindows.validate = originalValidate;
});

describe('SetupWindows', () => {
  // Regression test for a real bug: Docker.getWindowsCommand mounts
  // `${cliStoragePath}/registry-keys` unconditionally for every
  // Windows-Docker Unity build, but this directory was previously only
  // created for StandaloneWindows/StandaloneWindows64/WSAPlayer targets -
  // any other target (Android, iOS, WebGL, ...) hit "bind source path does
  // not exist" on the Docker mount. Confirmed live in game-ci/unity-builder
  // CI: an Android-targeted Windows Docker build failed with exactly this
  // Docker error before this fix.
  it('ensures the registry-keys directory exists for a non-Windows-SDK target platform (e.g. Android)', async () => {
    ValidateWindows.validate = mock(() => {});
    const ensureDirMock = mock(() => {});
    fs.ensureDir = ensureDirMock as any;
    const systemRunMock = mock(() => Promise.resolve(''));
    System.run = systemRunMock as any;

    await SetupWindows.setup({
      targetPlatform: 'Android',
      cliStoragePath: '/home/.game-ci',
    } as any);

    expect(ensureDirMock).toHaveBeenCalledWith('/home/.game-ci/registry-keys');
    // No WinSDK registry export needed for a non-Windows target.
    expect(systemRunMock).not.toHaveBeenCalled();
  });

  it('still ensures the directory AND runs the WinSDK registry export for StandaloneWindows64', async () => {
    ValidateWindows.validate = mock(() => {});
    const ensureDirMock = mock(() => {});
    fs.ensureDir = ensureDirMock as any;
    let capturedCommand = '';
    const systemRunMock = mock((command: string) => {
      capturedCommand = command;

      return Promise.resolve('');
    });
    System.run = systemRunMock as any;

    await SetupWindows.setup({
      targetPlatform: 'StandaloneWindows64',
      cliStoragePath: '/home/.game-ci',
    } as any);

    expect(ensureDirMock).toHaveBeenCalledWith('/home/.game-ci/registry-keys');
    expect(systemRunMock).toHaveBeenCalledTimes(1);
    expect(capturedCommand).toContain('reg export');
    expect(capturedCommand).toContain('/home/.game-ci/registry-keys/winsdk.reg');
  });
});
