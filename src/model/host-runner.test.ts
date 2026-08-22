import { describe, it, expect, mock, afterEach } from 'bun:test';
import { HostRunner } from './host-runner.ts';
import { System } from './system/system.ts';
import { path, fsSync as fs } from '../dependencies.ts';
import os from 'node:os';

// buildEnv/run both do a real fs.mkdirSync for ACTIVATE_LICENSE_PATH (see
// host-runner.ts) - previously these tests passed hardcoded paths like
// '/work/repo', which happened to succeed on a couple of local dev
// sandboxes but is not guaranteed writable (and reliably isn't, e.g.
// EACCES on GitHub's own Linux runners, which can't mkdir at filesystem
// root). Use a real, writable temp directory instead.
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'host-runner-test-'));

describe('HostRunner', () => {
  const originalSystemRun = System.run;

  afterEach(() => {
    System.run = originalSystemRun;
  });

  describe('buildEnv (private, accessed via any-cast)', () => {
    const buildEnv = (options: any): Record<string, string> => (HostRunner as any).buildEnv(options);

    it('sets ACTION_FOLDER from cliDistPath (needed by build scripts default-build-script fallback)', () => {
      const cliDistPath = path.join(scratchDir, 'dist');
      const env = buildEnv({
        currentWorkDir: scratchDir,
        cliDistPath,
        hostPlatform: 'linux',
      });

      expect(env.ACTION_FOLDER).toBe(cliDistPath);
    });

    it('points STEPS_DIR at the ubuntu steps dir for linux', () => {
      const cliDistPath = path.join(scratchDir, 'dist');
      const env = buildEnv({
        currentWorkDir: scratchDir,
        cliDistPath,
        hostPlatform: 'linux',
      });

      expect(env.STEPS_DIR).toBe(path.join(cliDistPath, 'platforms', 'ubuntu', 'steps'));
    });

    it('points STEPS_DIR at the native windows steps dir (not the Docker-container script set) for win32', () => {
      const env = buildEnv({
        currentWorkDir: 'C:\\work\\repo',
        cliDistPath: 'C:\\work\\repo\\dist',
        hostPlatform: 'win32',
      });

      expect(env.STEPS_DIR).toBe(path.join('C:\\work\\repo\\dist', 'platforms', 'windows', 'steps'));
    });
  });

  describe('stepsDir (private, accessed via any-cast)', () => {
    const stepsDir = (hostPlatform: string, cliDistPath: string): string =>
      (HostRunner as any).stepsDir(hostPlatform, cliDistPath);

    it('resolves the windows steps dir under platforms/windows/steps', () => {
      expect(stepsDir('win32', '/dist')).toBe(path.join('/dist', 'platforms', 'windows', 'steps'));
    });

    it('resolves the ubuntu steps dir under platforms/ubuntu/steps', () => {
      expect(stepsDir('linux', '/dist')).toBe(path.join('/dist', 'platforms', 'ubuntu', 'steps'));
    });
  });

  describe('run', () => {
    it('rejects unsupported host platforms (e.g. darwin) with a clear error', async () => {
      await expect(
        HostRunner.run({ hostPlatform: 'darwin', cliDistPath: '/dist', currentWorkDir: scratchDir } as any),
      ).rejects.toThrow(/only supported when running on Linux or Windows/);
    });

    it('no longer throws the old "Windows host-mode support is tracked separately" rejection for win32', async () => {
      const runMock = mock(() => Promise.resolve({ output: '', error: '', status: { success: true, code: 0 } }));
      System.run = runMock as any;

      await HostRunner.run({
        hostPlatform: 'win32',
        cliDistPath: path.join(scratchDir, 'dist'),
        currentWorkDir: scratchDir,
      } as any);

      expect(runMock).toHaveBeenCalled();
    });

    it('on win32, shells out via a nested powershell -File invocation of runsteps.ps1 and re-propagates its exit code', async () => {
      let capturedCommand = '';
      const runMock = mock((command: string) => {
        capturedCommand = command;
        return Promise.resolve({ output: '', error: '', status: { success: true, code: 0 } });
      });
      System.run = runMock as any;

      await HostRunner.run({
        hostPlatform: 'win32',
        cliDistPath: path.join(scratchDir, 'dist'),
        currentWorkDir: scratchDir,
      } as any);

      expect(capturedCommand).toContain('powershell');
      expect(capturedCommand).toContain('-File');
      expect(capturedCommand).toContain(path.join('platforms', 'windows', 'steps', 'runsteps.ps1'));
      expect(capturedCommand).toContain('exit $LASTEXITCODE');
    });

    it('on linux, shells out via bash to runsteps.sh (unchanged behavior)', async () => {
      let capturedCommand = '';
      const runMock = mock((command: string) => {
        capturedCommand = command;
        return Promise.resolve({ output: '', error: '', status: { success: true, code: 0 } });
      });
      System.run = runMock as any;

      const cliDistPath = path.join(scratchDir, 'dist');
      await HostRunner.run({
        hostPlatform: 'linux',
        cliDistPath,
        currentWorkDir: scratchDir,
      } as any);

      expect(capturedCommand).toBe(`bash "${path.join(cliDistPath, 'platforms', 'ubuntu', 'steps', 'runsteps.sh')}"`);
    });
  });
});
