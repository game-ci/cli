import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GENERATOR = path.join(import.meta.dirname, 'generate-embedded-assets.mjs');

let repo: string;

const git = (...args: string[]) => {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
};

const write = (relativePath: string, contents: string) => {
  const absolutePath = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
};

const generate = (...args: string[]) =>
  spawnSync('node', [path.join(repo, 'scripts', 'generate-embedded-assets.mjs'), ...args], {
    cwd: repo,
    encoding: 'utf8',
  });

const embeddedHash = () =>
  fs.readFileSync(path.join(repo, 'src', 'generated', 'embedded-assets.ts'), 'utf8').match(/HASH = '([^']+)'/)?.[1];

describe('generate-embedded-assets', () => {
  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'embedded-assets-'));
    git('init', '--quiet');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    fs.mkdirSync(path.join(repo, 'scripts'));
    fs.copyFileSync(GENERATOR, path.join(repo, 'scripts', 'generate-embedded-assets.mjs'));
    write('dist/step.sh', 'echo committed\n');
    write('dist/index.js', 'bundle\n');
    git('add', '.');
    git('commit', '--quiet', '-m', 'init');
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('embeds a clean dist/', () => {
    const result = generate();

    expect(result.status).toBe(0);
    expect(embeddedHash()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('refuses an unstaged change in dist/, naming the file', () => {
    write('dist/step.sh', 'echo changed\n');

    const result = generate();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/step.sh');
    expect(result.stderr).toContain('git add dist');
    expect(fs.existsSync(path.join(repo, 'src', 'generated', 'embedded-assets.ts'))).toBe(false);
  });

  it('refuses an untracked file in dist/', () => {
    write('dist/new-step.sh', 'echo new\n');

    const result = generate();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/new-step.sh');
  });

  it('refuses an unstaged deletion in dist/', () => {
    fs.rmSync(path.join(repo, 'dist', 'step.sh'));

    const result = generate();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist/step.sh');
  });

  it('refuses in --check mode too', () => {
    generate();
    write('dist/step.sh', 'echo changed\n');

    const result = generate('--check');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('git add dist');
  });

  it('embeds a staged change', () => {
    generate();
    const before = embeddedHash();
    write('dist/step.sh', 'echo changed\n');
    git('add', 'dist');

    const result = generate();

    expect(result.status).toBe(0);
    expect(embeddedHash()).not.toBe(before);
  });

  it('ignores dist/index.js, which is rebuilt from src/ and not embedded', () => {
    write('dist/index.js', 'rebuilt bundle\n');

    const result = generate();

    expect(result.status).toBe(0);
  });
});
