import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { execFile } from 'node:child_process';
import path from 'node:path';

const CLI_ENTRY = path.resolve(__dirname, '..', '..', 'cli.ts');

function runCli(
  cliArguments: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--require', 'ts-node/register/transpile-only', CLI_ENTRY, ...cliArguments],
      { timeout: 60_000, cwd: path.resolve(__dirname, '..', '..', '..') },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (error.code ?? 1) : 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
        });
      },
    );
  });
}

// Each test spawns a real `node --require ts-node/register/transpile-only`
// process, which has to transpile and load this package's full CLI
// dependency graph before it can even start parsing argv - genuinely slow,
// and slower still under CI's parallel test-shard contention. runCli's own
// execFile already allows up to 60s for that, but vitest's default per-test
// timeout is 5000ms regardless, so the wrapping `it()` was timing out (and
// failing the whole run under `set -e`-equivalent CI gating) long before the
// child process's own generous budget was ever exhausted - not a real
// failure, just a mismatched timeout. A 30s per-test timeout here comfortably
// covers real CI contention without masking a genuine hang (which would
// still exceed even that).
describe('CLI integration', { timeout: 30_000 }, () => {
  it('exits 0 and shows all commands for --help', async () => {
    const result = await runCli(['--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('game-ci');
    expect(result.stdout).toContain('build');
    expect(result.stdout).toContain('activate');
    expect(result.stdout).toContain('orchestrate');
    expect(result.stdout).toContain('status');
    expect(result.stdout).toContain('version');
    expect(result.stdout).toContain('update');
  });

  it('exits 0 and shows version info for version command', async () => {
    const result = await runCli(['version']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('orchestrator');
  });

  it('exits 0 and shows build flags for build --help', async () => {
    const result = await runCli(['build', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('--target-platform');
    expect(result.stdout).toContain('--unity-version');
    expect(result.stdout).toContain('--project-path');
    expect(result.stdout).toContain('--build-name');
    expect(result.stdout).toContain('--builds-path');
    expect(result.stdout).toContain('--build-method');
    expect(result.stdout).toContain('--custom-parameters');
    expect(result.stdout).toContain('--provider-strategy');
  });

  it('exits non-zero for an unknown command', async () => {
    const result = await runCli(['nonexistent']);

    expect(result.code).not.toStrictEqual(0);
  });

  it('exits non-zero when no command is provided', async () => {
    const result = await runCli([]);

    expect(result.code).not.toStrictEqual(0);
  });

  it('exits 0 for orchestrate --help', async () => {
    const result = await runCli(['orchestrate', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('--target-platform');
    expect(result.stdout).toContain('--provider-strategy');
    expect(result.stdout).toContain('cache');
  });

  it('exits 0 for activate --help', async () => {
    const result = await runCli(['activate', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('activate');
  });

  it('exits 0 for orchestrate cache --help', async () => {
    const result = await runCli(['orchestrate', 'cache', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('cache');
  });

  it('exits 0 for update --help', async () => {
    const result = await runCli(['update', '--help']);

    expect(result.code).toStrictEqual(0);
    expect(result.stdout).toContain('update');
    expect(result.stdout).toContain('--force');
    expect(result.stdout).toContain('--version');
  });
});
