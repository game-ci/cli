import type { YargsInstance } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';

/**
 * Options for `game-ci test` — Unity's own official test runner via Unity
 * CLI's `test` command (docs.unity.com/en-us/unity-cli).
 */
export class UnityTestOptions implements IOptions {
  public static configure(yargs: YargsInstance): void {
    yargs.option('unityCliArgs', {
      description: String.dedent`
        Raw arguments passed through to \`unity test\` verbatim, space-separated.
        Unity's own CLI reference doesn't publish a flag table for this command;
        run \`unity test --help\` on the installed binary for the authoritative
        list (see docs.unity.com/en-us/unity-cli).`,
      type: 'string',
      demandOption: false,
      default: '',
    });
  }
}
