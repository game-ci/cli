import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Logs } from './logs-facade';

function makeTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('Logs facade', () => {
  let workspace: string;
  let fakeHome: string;

  beforeEach(() => {
    workspace = makeTempRoot('logs-facade-ws-');
    fakeHome = makeTempRoot('logs-facade-home-');
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  it('collect() forwards to UnityLogCollectorService and returns a result', async () => {
    const unity3d = path.join(fakeHome, '.config', 'unity3d');
    fs.mkdirSync(path.join(unity3d, 'Unity'), { recursive: true });
    fs.writeFileSync(path.join(unity3d, 'Editor.log'), 'editor');

    const result = await Logs.collect({
      workspace,
      projectPath: workspace,
      platform: 'linux',
      env: { HOME: fakeHome } as NodeJS.ProcessEnv,
      categories: ['editor-log'],
    });

    expect(result.collected.map((c) => c.category)).toEqual(['editor-log']);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
  });

  it('tail() returns a stop handle', async () => {
    const filePath = path.join(workspace, 'Editor.log');
    fs.writeFileSync(filePath, 'first line\n');

    const lines: string[] = [];
    const handle = Logs.tail({
      files: [filePath],
      onLine: (_file, line) => lines.push(line),
      pollIntervalMs: 50,
      prefixWithFilename: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    fs.appendFileSync(filePath, 'second\n');
    await new Promise((resolve) => setTimeout(resolve, 200));
    handle.stop();

    expect(lines).toContain('first line');
    expect(lines).toContain('second');
  });

  it('exposes category introspection helpers', () => {
    const all = Logs.allCategoryIds();
    const safe = Logs.safeCategoryIds();

    expect(all).toContain('editor-log');
    expect(all).toContain('license-file');
    expect(safe).toContain('editor-log');
    expect(safe).not.toContain('license-file');

    const categories = Logs.categories();
    expect(categories.length).toBe(all.length);
    const editor = categories.find((c) => c.category === 'editor-log');
    expect(editor?.description).toMatch(/Editor\.log/);
  });

  it('parseCategories drops unknown entries', () => {
    expect(Logs.parseCategories('editor-log,bogus,licensing-client')).toEqual([
      'editor-log',
      'licensing-client',
    ]);
    expect(Logs.parseCategories('all')).toBeUndefined();
    expect(Logs.parseCategories('')).toBeUndefined();
  });
});
