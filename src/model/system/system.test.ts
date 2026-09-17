// TODO: This test file needs a rewrite for Bun compatibility.
// It uses jest.spyOn and jest.clearAllMocks which are not available in bun:test.
// The mocked System.run returns a number (0/1) but the real implementation returns RunResult.
// Skipping until rewritten with bun:test mock APIs.

import { describe, test, expect } from 'bun:test';
import { System } from './system.ts';

describe.skip('System (unit)', () => {
  test('placeholder', () => {
    expect(true).toBe(true);
  });
});

describe('System.run env option', () => {
  // Uses `node -e` instead of shell-native env var syntax (`$VAR` vs `$env:VAR`)
  // so this works identically under sh (Linux/Mac) and powershell (Windows).
  const printEnvVarCommand = (name: string) => `node -e "process.stdout.write(process.env.${name} || '')"`;

  test('merges options.env on top of the current process env for the spawned command', async () => {
    const result = await System.run(printEnvVarCommand('SOME_TEST_VAR'), undefined, {
      silent: true,
      env: { SOME_TEST_VAR: 'from-options-env' },
    });

    expect(result.output.trim()).toBe('from-options-env');
  });

  test('inherits the current process env when options.env is not given', async () => {
    process.env.SOME_INHERITED_VAR = 'inherited-value';
    try {
      const result = await System.run(printEnvVarCommand('SOME_INHERITED_VAR'), undefined, { silent: true });
      expect(result.output.trim()).toBe('inherited-value');
    } finally {
      delete process.env.SOME_INHERITED_VAR;
    }
  });
});

describe('System.run exit-code-based failure', () => {
  // Real bug (game-ci/unity-activate#111): this used to throw on any
  // stderr output regardless of exit code. `docker run` writes "Unable to
  // find image '...' locally" to stderr when auto-pulling, then succeeds
  // with exit code 0 - which was being thrown as a fatal error anyway.
  test('succeeds when stderr has output but the command exits 0', async () => {
    const command = 'node -e "process.stderr.write(\'just a warning\\n\')"';

    const result = await System.run(command, undefined, { silent: true });

    expect(result.status?.success).toBe(true);
    expect(result.error).toContain('just a warning');
  });

  test('throws when the command exits non-zero, even with empty stderr', async () => {
    // Exit code propagation through the shell wrapper (sh -c vs
    // powershell -Command) isn't consistent enough across platforms to
    // assert a specific code here - what matters is that a non-zero exit
    // with no stderr still throws, instead of silently resolving.
    const command = 'node -e "process.exit(3)"';

    await expect(System.run(command, undefined, { silent: true })).rejects.toThrow(/Command exited with code \d+/);
  });

  test('throws with the stderr content when the command exits non-zero', async () => {
    const command = 'node -e "process.stderr.write(\'boom\\n\'); process.exit(1)"';

    await expect(System.run(command, undefined, { silent: true })).rejects.toThrow('boom');
  });

  // Real bug (surfaced via Docker.run's own reworked error handling): the
  // rejected error's .message was built from stderr only, so anything a
  // failing command wrote to stdout - which for `docker run` is where the
  // container's own useful diagnostics live, not docker's own stderr
  // pull-progress noise - was completely unrecoverable by any catch block.
  // Attaching stdout/stderr onto the rejected error separately is what lets
  // a caller inspect the stream that actually matters instead of just the
  // (possibly irrelevant) message.
  test('rejects with the raw stdout still attached, even though it is not part of the message', async () => {
    const command = 'node -e "process.stdout.write(\'the real reason lives here\\n\'); process.exit(1)"';

    try {
      await System.run(command, undefined, { silent: true });
      throw new Error('expected System.run to reject');
    } catch (error: any) {
      expect(error.stdout).toContain('the real reason lives here');
    }
  });
});
