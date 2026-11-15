import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// The in-container scripts split CUSTOM_PARAMETERS shell-style via xargs (no eval).
// Run the real validation and mapfile lines from each script rather than a copy of them.
const scripts = ['test.sh', 'build.sh'].map((name) =>
  path.resolve(import.meta.dir, '../../dist/platforms/ubuntu/steps', name),
);

function scriptLine(lines: string[], marker: string) {
  const line = lines.find((l) => l.includes(marker));
  if (!line) throw new Error(`No line containing "${marker}"`);
  return line;
}

function split(script: string, customParameters: string) {
  const lines = fs.readFileSync(script, 'utf8').split('\n');
  const validate = scriptLine(lines, 'xargs -r true');
  const parse = scriptLine(lines, 'mapfile -t customParameters');
  const run = spawnSync(
    'bash',
    ['-c', `${validate}\n${parse}\nfor t in "\${customParameters[@]}"; do printf '%s\\n' "$t"; done`],
    {
      env: { ...process.env, CUSTOM_PARAMETERS: customParameters },
      encoding: 'utf8',
    },
  );
  return { status: run.status, stderr: run.stderr, args: run.stdout.split('\n').slice(0, -1) };
}

describe.each(scripts)('CUSTOM_PARAMETERS splitting in %s', (script) => {
  it('removes shell quotes, as in the Unity manual', () => {
    expect(split(script, '-testCategory "!IgnoreCI;!Integration" -x')).toMatchObject({
      status: 0,
      args: ['-testCategory', '!IgnoreCI;!Integration', '-x'],
    });
  });

  it('does not expand or execute substitutions', () => {
    expect(split(script, '-a $(echo pwned) `id`')).toMatchObject({
      status: 0,
      args: ['-a', '$(echo', 'pwned)', '`id`'],
    });
  });

  it('yields no arguments for an empty value', () => {
    expect(split(script, '')).toMatchObject({ status: 0, args: [] });
  });

  it('fails the step on an unbalanced quote instead of dropping the parameters', () => {
    const result = split(script, '-a "unclosed');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid customParameters');
    expect(result.args).toEqual([]);
  });
});
