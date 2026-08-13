import { describe, it, expect, mock, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BuildImageCommand } from './build-image-command.ts';
import { System } from '../../model/system/system.ts';

const tempFiles: string[] = [];
const originalSystemRun = System.run;

function writeTempRecipe(contents: string): string {
  const filePath = path.join(os.tmpdir(), `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}.yml`);
  fs.writeFileSync(filePath, contents);
  tempFiles.push(filePath);
  return filePath;
}

afterEach(() => {
  while (tempFiles.length > 0) {
    const filePath = tempFiles.pop()!;
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
  // System.run is a shared static — restore it so other test files that
  // exercise the real implementation aren't affected by this file's mocks.
  System.run = originalSystemRun;
});

describe('BuildImageCommand recipe support', () => {
  it('fails clearly when neither --unity-version nor --recipe provide a version', async () => {
    const command = new BuildImageCommand('build-unity-image');
    const result = await command.execute({} as any);

    expect(result).toBe(false);
  });

  it('fails clearly when --recipe points at a nonexistent file', async () => {
    const command = new BuildImageCommand('build-unity-image');
    const result = await command.execute({ recipe: '/does/not/exist.yml' } as any);

    expect(result).toBe(false);
  });

  it('recipe fields take priority over CLI flags for the same setting', async () => {
    const filePath = writeTempRecipe('unityVersion: 2022.3.20f1\nbaseOs: windows\nchangeset: abc123\n');

    let capturedCommand = '';
    System.run = mock((command: string) => {
      capturedCommand = command;
      return Promise.resolve({ status: { success: true, code: 0 }, output: '', error: '' } as any);
    });

    const command = new BuildImageCommand('build-unity-image');
    const result = await command.execute({
      recipe: filePath,
      baseOs: 'ubuntu', // should be overridden by the recipe's "windows"
      unityVersion: '2021.3.1f1', // should be overridden by the recipe's version
    } as any);

    expect(result).toBe(true);
    expect(capturedCommand).toContain('unityci/editor:windows-2022.3.20f1');
  });

  it('falls back to CLI flags for fields the recipe does not declare', async () => {
    const filePath = writeTempRecipe('unityVersion: 2022.3.20f1\nchangeset: abc123\n');

    let capturedCommand = '';
    System.run = mock((command: string) => {
      capturedCommand = command;
      return Promise.resolve({ status: { success: true, code: 0 }, output: '', error: '' } as any);
    });

    const command = new BuildImageCommand('build-unity-image');
    const result = await command.execute({
      recipe: filePath,
      baseOs: 'windows', // recipe doesn't set baseOs, so this flag applies
    } as any);

    expect(result).toBe(true);
    expect(capturedCommand).toContain('unityci/editor:windows-2022.3.20f1');
  });

  it('reports failure cleanly when the docker build throws (System.run throws on error rather than returning a checkable failure)', async () => {
    const filePath = writeTempRecipe('unityVersion: 2022.3.20f1\nchangeset: abc123\n');

    System.run = mock(() => Promise.reject(new Error('docker: no such file or directory')));

    const command = new BuildImageCommand('build-unity-image');
    const result = await command.execute({ recipe: filePath } as any);

    expect(result).toBe(false);
  });
});
