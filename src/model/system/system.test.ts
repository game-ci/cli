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
