import { describe, it, expect, mock, afterEach, beforeAll, afterAll } from 'bun:test';
import { Docker } from '../../model/index.ts';
import { fsSync } from '../../dependencies.ts';
import { GodotBuildCommand } from './godot-build-command.ts';

// fsSync (exported as fsSyncCompat) is a plain object, so its properties
// can be reassigned directly on the real, already-imported module - same
// as how Docker.run is stubbed below. Deliberately NOT using mock.module
// here: dependencies.ts is imported by most of this codebase, and
// mock.module patches the module registry process-wide (bun runs all test
// files in one process) - replacing it wholesale broke ~20 unrelated tests
// elsewhere that read the real filesystem through the same module.
const originalExistsSync = fsSync.existsSync;
const originalDockerRun = Docker.run;
let originalLogInfo: ((msg: any, ...args: any[]) => void) | undefined;
let originalLogGroup: ((title: string, fn: () => Promise<void>) => Promise<void>) | undefined;

beforeAll(() => {
  originalLogInfo = (globalThis as any).log?.info;
  originalLogGroup = (globalThis as any).log?.group;
  if ((globalThis as any).log) {
    (globalThis as any).log.info = () => {};
    (globalThis as any).log.group = async (_title: string, fn: () => Promise<void>) => fn();
  }
});

afterAll(() => {
  if ((globalThis as any).log) {
    if (originalLogInfo) (globalThis as any).log.info = originalLogInfo;
    if (originalLogGroup) (globalThis as any).log.group = originalLogGroup;
  }
});

afterEach(() => {
  Docker.run = originalDockerRun;
  fsSync.existsSync = originalExistsSync;
});

describe('GodotBuildCommand', () => {
  it('falls back to --import when export_presets.cfg is missing (real projects commonly omit it)', async () => {
    fsSync.existsSync = () => false;
    const command = new GodotBuildCommand('build');

    const dockerRunMock = mock(async (_image: string, options: any) => {
      expect(options.commands).toBe('godot --headless --verbose --import');
    });
    Docker.run = dockerRunMock as any;

    const result = await command.execute({ projectPath: '/some/project' } as any);

    expect(result).toBe(true);
    expect(dockerRunMock).toHaveBeenCalledTimes(1);
  });

  it('exports for real when export_presets.cfg is present', async () => {
    fsSync.existsSync = () => true;
    const command = new GodotBuildCommand('build');

    const dockerRunMock = mock(async (_image: string, options: any) => {
      expect(options.commands).toBe('godot --headless --verbose --export-release "Linux/X11" build/game');
    });
    Docker.run = dockerRunMock as any;

    const result = await command.execute({ projectPath: '/some/project' } as any);

    expect(result).toBe(true);
    expect(dockerRunMock).toHaveBeenCalledTimes(1);
  });

  it('checks for export_presets.cfg inside projectPath', async () => {
    const existsSyncMock = mock((_path: string) => false);
    fsSync.existsSync = existsSyncMock as any;
    const command = new GodotBuildCommand('build');
    Docker.run = mock(async () => {}) as any;

    await command.execute({ projectPath: '/some/project' } as any);

    const calledWith = existsSyncMock.mock.calls[0][0] as string;
    expect(calledWith.replace(/\\/g, '/')).toBe('/some/project/export_presets.cfg');
  });
});
