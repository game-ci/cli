import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import { UnityCliAdapter } from '../../model/unity-cli-adapter.ts';
import { UnityRunOptions } from '../../command-options/unity-run-options.ts';
import type { YargsInstance, Options } from '../../dependencies.ts';

/**
 * `game-ci run --command <Method>` — a standardized alternative to bespoke
 * `-executeMethod` batch entry points, backed by Unity's own official Unity
 * CLI (docs.unity.com/en-us/unity-cli, still experimental upstream). See
 * game-ci/roadmap#11 workstream 3.
 *
 * Requires the `unity` CLI binary on PATH — this does not fall back to
 * game-ci's Docker/Hub-based flows, since Unity CLI's `run --command` has no
 * equivalent there.
 */
export class UnityRunCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const command = options.command as string;
    const extraArgs = String(options.unityCliArgs || '')
      .split(' ')
      .map((arg) => arg.trim())
      .filter(Boolean);

    const available = await UnityCliAdapter.isAvailable();
    if (!available) {
      throw new Error(
        'run: requires Unity\'s official `unity` CLI binary on PATH ' +
          '(https://docs.unity.com/en-us/unity-cli). Not found in this environment.',
      );
    }

    const result = await UnityCliAdapter.runCommand(command, extraArgs);
    log.info(result.output);

    return result.success;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    UnityRunOptions.configure(yargs);
  }
}
