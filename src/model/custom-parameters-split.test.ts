import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// The in-container scripts split CUSTOM_PARAMETERS shell-style via xargs (no eval).
// Run the real mapfile line from each script rather than a copy of it.
const scripts = ['test.sh', 'build.sh'].map((name) =>
  path.resolve(import.meta.dir, '../../dist/platforms/ubuntu/steps', name),
);

function split(script: string, customParameters: string) {
  const line = fs.readFileSync(script, 'utf8').split('\n').find((l) => l.includes('mapfile -t customParameters'))!;
  const run = spawnSync('bash', ['-c', `${line}\nfor t in "\${customParameters[@]}"; do printf '%s\\n' "$t"; done`], {
    env: { ...process.env, CUSTOM_PARAMETERS: customParameters },
    encoding: 'utf8',
  });
  return run.stdout.split('\n').slice(0, -1);
}

describe.each(scripts)('CUSTOM_PARAMETERS splitting in %s', (script) => {
  it('removes shell quotes, as in the Unity manual', () => {
    expect(split(script, '-testCategory "!IgnoreCI;!Integration" -x')).toEqual([
      '-testCategory',
      '!IgnoreCI;!Integration',
      '-x',
    ]);
  });

  it('does not expand or execute substitutions', () => {
    expect(split(script, '-a $(echo pwned) `id`')).toEqual(['-a', '$(echo', 'pwned)', '`id`']);
  });

  it('yields no arguments for an empty value', () => {
    expect(split(script, '')).toEqual([]);
  });
});
