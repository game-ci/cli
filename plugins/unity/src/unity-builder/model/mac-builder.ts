import { exec } from '@actions/exec';
import * as core from '@actions/core';

class MacBuilder {
  // A known, transient macOS/Unity flake: the Licensing Client's own
  // codesign verification occasionally fails right after a fresh Unity
  // Hub install on a GitHub-hosted runner, before any real build work has
  // started (confirmed against game-ci/unity-builder#844's CI - the exact
  // same job config passed a few minutes later in a sibling run). It's not
  // something this tool can fix in Unity itself, but failing the whole
  // build - and the PR check along with it - on a licensing hiccup that
  // has nothing to do with the actual build's correctness is exactly the
  // kind of false negative that erodes trust in CI. Retry a few times
  // before surfacing it as a real failure.
  private static readonly TRANSIENT_LICENSING_ERROR_PATTERN =
    /Error: Code 10 while verifying Licensing Client signature/;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 10_000;

  public static async run(actionFolder: string, silent: boolean = false): Promise<number> {
    let exitCode = 1;

    for (let attempt = 1; attempt <= MacBuilder.MAX_ATTEMPTS; attempt++) {
      let output = '';
      // eslint-disable-next-line no-await-in-loop
      exitCode = await exec('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
        silent,
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
          stderr: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      if (exitCode === 0) return exitCode;
      if (!MacBuilder.TRANSIENT_LICENSING_ERROR_PATTERN.test(output)) return exitCode;
      if (attempt === MacBuilder.MAX_ATTEMPTS) break;

      core.warning(
        `Unity's Licensing Client hit a transient signature-verification error (attempt ${attempt}/${MacBuilder.MAX_ATTEMPTS}). Retrying in ${MacBuilder.RETRY_DELAY_MS / 1000}s.`,
      );
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, MacBuilder.RETRY_DELAY_MS);
      });
    }

    return exitCode;
  }
}

export default MacBuilder;
