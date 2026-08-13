import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import { UnityCliAdapter } from '../../model/unity-cli-adapter.ts';
import { UnityTestOptions } from '../../command-options/unity-test-options.ts';
import type { YargsInstance, Options } from '../../dependencies.ts';

/**
 * `game-ci test` — runs Unity's own official test runner via Unity CLI's
 * `test` command (docs.unity.com/en-us/unity-cli, still experimental
 * upstream), as an alternative to unity-test-runner's Docker/Hub-driven
 * flow. See game-ci/roadmap#11 workstream 3 and game-ci/cli#58.
 *
 * Requires the `unity` CLI binary on PATH. Unity's own docs don't publish
 * a flag table for `test` (unlike `install`/`install-modules`) — they
 * explicitly point to `unity test --help` on the installed binary as the
 * authoritative reference. So this command doesn't invent or guess at flags:
 * everything after --unityCliArgs is passed through to `unity test` verbatim.
 */
export class UnityTestCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const extraArgs = String(options.unityCliArgs || '')
      .split(' ')
      .map((arg) => arg.trim())
      .filter(Boolean);

    const available = await UnityCliAdapter.isAvailable();
    if (!available) {
      throw new Error(
        "test: requires Unity's official `unity` CLI binary on PATH " +
          '(https://docs.unity.com/en-us/unity-cli). Not found in this environment.',
      );
    }

    try {
      const result = await UnityCliAdapter.test(extraArgs);
      log.info(result.output);

      return result.success;
    } catch (error: any) {
      // UnityCliAdapter.test rejects (rather than resolving with
      // success: false) whenever the underlying process writes to stderr,
      // which is common even for otherwise-successful Unity CLI invocations.
      throw new Error(`test: 'unity test' failed: ${error.message}`);
    }
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await UnityTestOptions.configure(yargs);
  }
}
