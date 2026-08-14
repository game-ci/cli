import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UnityLogCollectorService } from './unity-log-collector-service';
import { UnityLogTailService } from './unity-log-tail-service';

function makeTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('UnityLogCollectorService', () => {
  let workspace: string;
  let project: string;
  let fakeHome: string;

  beforeEach(() => {
    workspace = makeTempRoot('uls-ws-');
    project = path.join(workspace, 'project');
    fakeHome = makeTempRoot('uls-home-');
    fs.mkdirSync(project, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  it('collects Linux Editor.log + licensing logs into the artifact directory', () => {
    const unity3d = path.join(fakeHome, '.config', 'unity3d');
    fs.mkdirSync(path.join(unity3d, 'Unity'), { recursive: true });
    fs.writeFileSync(path.join(unity3d, 'Editor.log'), 'unity editor log line\n');
    fs.writeFileSync(
      path.join(unity3d, 'Unity', 'Unity.Licensing.Client.log'),
      'licensing log line\n',
    );
    fs.writeFileSync(
      path.join(unity3d, 'Unity', 'Unity.Entitlements.Audit.log'),
      'audit log line\n',
    );

    const result = UnityLogCollectorService.collect({
      workspace,
      projectPath: project,
      platform: 'linux',
      env: { HOME: fakeHome } as NodeJS.ProcessEnv,
      categories: ['editor-log', 'licensing-client', 'entitlements-audit'],
    });

    expect(result.collected.map((c) => c.category).sort()).toEqual([
      'editor-log',
      'entitlements-audit',
      'licensing-client',
    ]);
    expect(result.totalBytes).toBeGreaterThan(0);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(fs.existsSync(path.join(result.outputDir, 'editor-log', 'Editor.log'))).toBe(true);
    expect(
      fs.existsSync(path.join(result.outputDir, 'licensing-client', 'Unity.Licensing.Client.log')),
    ).toBe(true);
  });

  it('records missing categories without throwing', () => {
    const result = UnityLogCollectorService.collect({
      workspace,
      projectPath: project,
      platform: 'linux',
      env: { HOME: fakeHome } as NodeJS.ProcessEnv,
      categories: ['editor-log', 'licensing-client'],
    });

    expect(result.collected).toEqual([]);
    expect(result.missing.map((m) => m.category).sort()).toEqual([
      'editor-log',
      'licensing-client',
    ]);
  });

  it('skips sensitive categories by default', () => {
    const programData = path.join(fakeHome, 'programdata');
    fs.mkdirSync(path.join(programData, 'Unity'), { recursive: true });
    fs.writeFileSync(path.join(programData, 'Unity', 'Unity_lic.ulf'), 'fake-license-data');

    const result = UnityLogCollectorService.collect({
      workspace,
      projectPath: project,
      platform: 'win32',
      env: { PROGRAMDATA: programData } as NodeJS.ProcessEnv,
      categories: ['license-file'],
    });

    expect(result.collected).toEqual([]);
  });

  it('collects sensitive categories when explicitly opted in', () => {
    const programData = path.join(fakeHome, 'programdata');
    fs.mkdirSync(path.join(programData, 'Unity'), { recursive: true });
    fs.writeFileSync(path.join(programData, 'Unity', 'Unity_lic.ulf'), 'fake-license-data');

    const result = UnityLogCollectorService.collect({
      workspace,
      projectPath: project,
      platform: 'win32',
      env: { PROGRAMDATA: programData } as NodeJS.ProcessEnv,
      categories: ['license-file'],
      includeSensitive: true,
    });

    expect(result.collected.map((c) => c.category)).toEqual(['license-file']);
  });

  it('collects workspace-relative categories like build-report and bee-backend', () => {
    const library = path.join(project, 'Library');
    fs.mkdirSync(path.join(library, 'Bee'), { recursive: true });
    fs.writeFileSync(path.join(library, 'LastBuild.buildreport'), 'binary');
    fs.writeFileSync(path.join(library, 'Bee', 'bee_backend.log'), 'bee backend');

    const result = UnityLogCollectorService.collect({
      workspace,
      projectPath: project,
      platform: 'linux',
      env: {} as NodeJS.ProcessEnv,
      categories: ['build-report', 'bee-backend'],
    });

    expect(result.collected.map((c) => c.category).sort()).toEqual(['bee-backend', 'build-report']);
  });

  it('parses category lists, treating "all" as undefined and dropping unknowns', () => {
    expect(UnityLogCollectorService.parseCategories(undefined)).toBeUndefined();
    expect(UnityLogCollectorService.parseCategories('')).toBeUndefined();
    expect(UnityLogCollectorService.parseCategories('all')).toBeUndefined();
    expect(
      UnityLogCollectorService.parseCategories('editor-log,does-not-exist,licensing-client'),
    ).toEqual(['editor-log', 'licensing-client']);
  });

  it('emits a non-empty container copy script', () => {
    const script = UnityLogCollectorService.buildContainerCopyScript('/github/workspace');
    expect(script).toContain('/root/.config/unity3d/Editor.log');
    expect(script).toContain('/usr/share/unity3d/config/services-config.json');
    expect(script).toContain('/github/workspace/Logs/UnityDiagnostics');
  });
});

describe('UnityLogTailService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempRoot('ult-');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('streams new lines as they are appended', async () => {
    const filePath = path.join(tempDir, 'Editor.log');
    fs.writeFileSync(filePath, 'line one\n');

    const lines: string[] = [];
    const tail = new UnityLogTailService({
      files: [filePath],
      onLine: (_file, line) => lines.push(line),
      pollIntervalMs: 50,
      prefixWithFilename: false,
    });
    tail.start();

    await new Promise((resolve) => setTimeout(resolve, 100));
    fs.appendFileSync(filePath, 'line two\nline three\n');
    await new Promise((resolve) => setTimeout(resolve, 250));
    tail.stop();

    expect(lines).toContain('line one');
    expect(lines).toContain('line two');
    expect(lines).toContain('line three');
  });

  it('waits for files that do not yet exist', async () => {
    const filePath = path.join(tempDir, 'late.log');
    const lines: string[] = [];
    const tail = new UnityLogTailService({
      files: [filePath],
      onLine: (_file, line) => lines.push(line),
      pollIntervalMs: 50,
      prefixWithFilename: false,
    });
    tail.start();

    await new Promise((resolve) => setTimeout(resolve, 80));
    fs.writeFileSync(filePath, 'first\n');
    await new Promise((resolve) => setTimeout(resolve, 250));
    tail.stop();

    expect(lines).toContain('first');
  });
});
