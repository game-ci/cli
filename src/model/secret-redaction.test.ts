import { describe, it, expect, afterEach } from 'bun:test';
import { SecretRedaction } from './secret-redaction.ts';

afterEach(() => {
  // Module-level registry shared across the whole test process.
  SecretRedaction.reset();
});

describe('SecretRedaction', () => {
  it('redacts a registered secret', () => {
    SecretRedaction.register('hunter2secret');

    expect(SecretRedaction.redact('--env UNITY_PASSWORD="hunter2secret"')).toBe('--env UNITY_PASSWORD="***"');
  });

  it('redacts every occurrence, not just the first', () => {
    SecretRedaction.register('hunter2secret');

    expect(SecretRedaction.redact('hunter2secret and hunter2secret')).toBe('*** and ***');
  });

  it('leaves text alone when nothing is registered', () => {
    expect(SecretRedaction.redact('docker run --rm image')).toBe('docker run --rm image');
  });

  it('treats secrets as literals, not patterns', () => {
    // A password of ".*" would otherwise compile to a regex matching
    // everything and blank the entire log line.
    SecretRedaction.register('.*');
    SecretRedaction.register('a+b(c)');

    expect(SecretRedaction.redact('docker run a+b(c) image')).toBe('docker run *** image');
  });

  it('ignores values too short to match safely', () => {
    // A two-character secret would match unrelated substrings everywhere.
    SecretRedaction.register('ab');

    expect(SecretRedaction.redact('about absolutely')).toBe('about absolutely');
  });

  it('ignores undefined and empty values', () => {
    SecretRedaction.register(undefined, '', '   ');

    expect(SecretRedaction.redact('unchanged text')).toBe('unchanged text');
  });

  it('picks up the secret-bearing options from an options bag', () => {
    SecretRedaction.registerFromOptions({
      unityPassword: 'pa55word-value',
      unityEmail: 'ci@example.com',
      unitySerial: 'F4-ABCD-EFGH',
      projectPath: '/home/runner/work/project',
    } as any);

    const command = 'docker run --env UNITY_PASSWORD="pa55word-value" --env UNITY_EMAIL="ci@example.com" --env UNITY_SERIAL="F4-ABCD-EFGH" /home/runner/work/project';

    expect(SecretRedaction.redact(command)).toBe(
      'docker run --env UNITY_PASSWORD="***" --env UNITY_EMAIL="***" --env UNITY_SERIAL="***" /home/runner/work/project',
    );
  });

  it('does not redact non-secret options', () => {
    SecretRedaction.registerFromOptions({ projectPath: '/home/runner/work/project' } as any);

    expect(SecretRedaction.redact('cd /home/runner/work/project')).toBe('cd /home/runner/work/project');
  });
});
