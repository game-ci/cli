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
  'androidKeystorePass',
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
      redacted = redacted.replaceAll(new RegExp(escapeForRegExp(secret), 'g'), placeholder);
    }

    return redacted;
  },

  /** Test seam - the registry is module-level state shared across a process. */
  reset() {
    secrets.clear();
  },
};

export { SecretRedaction, secretOptionKeys };
