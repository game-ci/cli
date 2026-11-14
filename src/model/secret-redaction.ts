/**
 * Keeps secret values out of the CLI's own log output.
 *
 * The CLI logs the full `docker run` invocation at -vv (Docker.run) and the
 * full shell command on a silent run (System.run). Both strings contain
 * `--env UNITY_PASSWORD="..."` verbatim, so a user pasting a -vv log into an
 * issue leaks their credentials. Nothing in src/ redacted anything before
 * this; the only masking that existed was in plugins/unity, gated on a
 * 27-character serial.
 *
 * This matters more now than it did. Under serial activation the password was
 * secondary to a serial that Unity itself masks; under personal (free)
 * activation the account password *is* the credential, and free-tier users
 * are exactly the group most likely to paste a verbose log into a bug report.
 *
 * Registration is explicit rather than scanning process.env, so an unrelated
 * environment variable that happens to hold a common word can't blank out
 * chunks of unrelated log output.
 */

/**
 * Option keys whose values must never reach the log. `unityEmail` is included
 * deliberately: it is not a credential on its own, but half of one, and it is
 * personal data that has no reason to appear in CI output.
 */
const secretOptionKeys = [
  'unityPassword',
  'unityEmail',
  'unitySerial',
  'unityLicense',
  'gitPrivateToken',
  'androidKeystorePassword',
  'androidKeystorePass',
  'androidKeyAliasPassword',
  'androidKeyAliasPass',
  'androidKeyaliasPass',
  'privateRegistryToken',
  'usymUploadAuthToken',
];

const placeholder = '***';

/** Short values would match far too much unrelated text to be safe to replace. */
const minimumSecretLength = 4;

const secrets = new Set<string>();

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Matches the secret both raw and as ImageEnvironmentFactory inlines it into
 * the sh command string, where backslash, `"`, `$` and backtick carry a
 * backslash prefix. Reusing that module's escape helper would be more direct,
 * but the logger loads this module, so it stays free of imports.
 */
function secretPattern(secret: string): RegExp {
  const pattern = [...secret]
    .map((char) => (/[\\"$`]/.test(char) ? `\\\\?${escapeForRegExp(char)}` : escapeForRegExp(char)))
    .join('');

  return new RegExp(pattern, 'g');
}

const SecretRedaction = {
  register(...values: (string | undefined)[]) {
    for (const value of values) {
      if (typeof value !== 'string') continue;

      const trimmed = value.trim();
      if (trimmed.length < minimumSecretLength) continue;

      secrets.add(trimmed);
    }
  },

  /**
   * Takes a plain record rather than the yargs Options type on purpose: the
   * logger imports this module, so it must not pull in dependencies.ts and
   * risk an import cycle. Accepts anything option-shaped, including a config
   * file's cliOptions block, which is parsed before the options bag exists.
   */
  registerFromOptions(options: Record<string, unknown> | undefined | null) {
    if (!options) return;

    SecretRedaction.register(...secretOptionKeys.map((key) => options[key] as string | undefined));
  },

  /**
   * Replaces every registered secret with `***`. Safe to call on any string;
   * returns it unchanged when nothing is registered.
   */
  redact(text: string): string {
    let redacted = text;

    for (const secret of secrets) {
      redacted = redacted.replaceAll(secretPattern(secret), placeholder);
    }

    return redacted;
  },

  /** Test seam - the registry is module-level state shared across a process. */
  reset() {
    secrets.clear();
  },
};

/**
 * A line longer than this with no line break is emitted in pieces rather than
 * held indefinitely, keeping just enough of its tail back to catch a secret
 * that straddles the piece boundary.
 */
const maximumHeldLineLength = 64 * 1024;

/**
 * The patterns live output is redacted with: every registered secret, plus each
 * line of a multi-line secret (a licence file, say) on its own. Output is
 * emitted a line at a time, so a multi-line secret can reach the log split
 * across two emissions; masking its lines individually keeps both halves out.
 * Longest first, so a whole secret is replaced before any of its lines.
 */
function streamPatterns(): RegExp[] {
  const values = new Set<string>();

  for (const secret of secrets) {
    values.add(secret);

    for (const line of secret.split(/\r\n|[\r\n]/)) {
      const trimmed = line.trim();
      if (trimmed.length >= minimumSecretLength) values.add(trimmed);
    }
  }

  return [...values].sort((a, b) => b.length - a.length).map((value) => secretPattern(value));
}

/**
 * Redacts text that arrives in pieces (live subprocess output). Text is
 * emitted a whole line at a time, the way the GitHub Actions runner masks its
 * own log: a secret within a line is always seen whole, lines from stdout and
 * stderr interleave intact, and nothing is held back beyond the line still
 * being written. flush() emits whatever remains.
 */
const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;

function createStreamRedactor() {
  let pending = '';

  const redactWith = (patterns: RegExp[], text: string) =>
    patterns.reduce((redacted, pattern) => redacted.replaceAll(pattern, placeholder), text);

  const emit = (final: boolean): string => {
    if (secrets.size === 0) {
      const text = pending;
      pending = '';
      return text;
    }

    const patterns = streamPatterns();
    let cut = final ? pending.length : Math.max(pending.lastIndexOf('\n'), pending.lastIndexOf('\r')) + 1;

    if (cut === 0 && pending.length > maximumHeldLineLength) {
      // Escaped characters gain a backslash, so a match can be twice as long as its value.
      const longestMatch = Math.max(...[...secrets].map((secret) => secret.length)) * 2;
      cut = pending.length - (longestMatch - 1);

      for (const pattern of patterns) {
        for (const match of pending.matchAll(pattern)) {
          if (match.index < cut && cut < match.index + match[0].length) cut = match.index;
        }
      }
    }

    // Never emit half of a surrogate pair: each piece is UTF-8 encoded on its own.
    if (cut < pending.length && isHighSurrogate(pending.charCodeAt(cut - 1))) cut -= 1;

    if (cut <= 0) return '';

    const out = redactWith(patterns, pending.slice(0, cut));
    pending = pending.slice(cut);
    return out;
  };

  return {
    push(text: string): string {
      pending += text;
      return emit(false);
    },
    flush(): string {
      return emit(true);
    },
  };
}

export { SecretRedaction, createStreamRedactor, secretOptionKeys };
