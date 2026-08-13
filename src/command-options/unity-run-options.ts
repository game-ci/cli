import type { YargsInstance } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';

/**
 * Options for `game-ci run` — a standardized alternative to bespoke
 * `-executeMethod` batch entry points, backed by Unity's own official
 * Unity CLI `run --command` (docs.unity.com/en-us/unity-cli).
 */
export class UnityRunOptions implements IOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .option('command', {
        alias: 'c',
        description: String.dedent`
          Fully-qualified static method to invoke, e.g. MyNamespace.MyClass.MyMethod.
          Passed through to Unity CLI's \`run --command\` — see
          docs.unity.com/en-us/unity-cli for the current syntax.`,
        type: 'string',
        demandOption: true,
      })
      .option('unityCliArgs', {
        description: 'Additional raw arguments appended to the underlying `unity run` invocation, space-separated.',
        type: 'string',
        demandOption: false,
        default: '',
      });
  }
}
