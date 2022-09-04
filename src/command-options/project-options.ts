import { getHomeDir, YargsInstance } from '../dependencies.ts';
import { engineDetection } from '../middleware/engine-detection/index.ts';
import { vcsDetection } from '../middleware/vcs-detection/index.ts';

export class ProjectOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .positional('projectPath', {
        describe: 'Path to the project',
        type: 'string',
        demandOption: false,
        default: '.',
      })
      .coerce('projectPath', async (arg) => {
        return arg.replace(/^~/, getHomeDir()).replace(/\/$/, '');
      })
      .default('engine', '')
      .default('engineVersion', '')
      .middleware([engineDetection], true)
      .default('branch', '')
      .middleware([vcsDetection], true);
  }
}
