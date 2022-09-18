import { getHomeDir, YargsInstance } from '../dependencies.ts';
import { engineDetection } from '../middleware/engine-detection/index.ts';
import { vcsDetection } from '../middleware/vcs-detection/index.ts';
import { IOptions } from './options-interface.ts';

export class ProjectOptions implements IOptions {
  /**
   * Configuration, used by middleware to detect the engine and VCS.
   *
   * Note: keep this method to a minimum, as it is processed before showing the help message.
   */
  public static preConfigure(yargs: YargsInstance): void {
    yargs
      .positional('projectPath', {
        describe: 'Path to the project',
        type: 'string',
        demandOption: false,
        default: '.',
      })
      .coerce('projectPath', async (arg: string) => {
        const homeDir = getHomeDir();

        if (homeDir === null) throw new Error('Could not determine home directory');

        return arg.replace(/^~/, homeDir).replace(/\/$/, '');
      })
      .default('engine', '')
      .default('engineVersion', '')
      .middleware([engineDetection], true)
      .default('branch', '')
      .middleware([vcsDetection], true);
  }

  public static async configure(yargs: YargsInstance): Promise<void> {}
}
