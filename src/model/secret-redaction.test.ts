import { describe, it, expect, afterEach } from 'bun:test';
import { SecretRedaction, createStreamRedactor } from './secret-redaction.ts';

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

  it('redacts a secret in its shell-escaped form as well as raw', () => {
    // The docker command string backslash-escapes `"` and `$` inside double
    // quotes, so the logged form of the password differs from the raw one.
    SecretRedaction.register('pa$$"word');

    expect(SecretRedaction.redact('--env UNITY_PASSWORD="pa\\$\\$\\"word" raw: pa$$"word')).toBe(
      '--env UNITY_PASSWORD="***" raw: ***',
    );
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

describe('createStreamRedactor', () => {
  const collect = (chunks: string[]) => {
    const redactor = createStreamRedactor();
    return chunks.map((chunk) => redactor.push(chunk)).join('') + redactor.flush();
  };

  it('passes text through untouched when nothing is registered', () => {
    expect(collect(['hello ', 'world'])).toBe('hello world');
  });

  it('redacts a secret split across two chunks', () => {
    SecretRedaction.register('hunter2secret');

    expect(collect(['password=hunt', 'er2secret done'])).toBe('password=*** done');
  });

  it('redacts a secret split one character at a time', () => {
    SecretRedaction.register('hunter2secret');

    expect(collect([...'a hunter2secret b'])).toBe('a *** b');
  });

  it('never emits a secret prefix before the rest arrives', () => {
    SecretRedaction.register('hunter2secret');
    const redactor = createStreamRedactor();

    expect(redactor.push('x hunter2')).not.toContain('hunter2');
  });

  it('flushes held-back text that turned out not to be a secret', () => {
    SecretRedaction.register('hunter2secret');

    expect(collect(['ends with hunter2'])).toBe('ends with hunter2');
  });
});
