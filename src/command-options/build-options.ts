import { YargsArguments, YargsInstance } from '../dependencies.ts';
import UnityTargetPlatform from '../model/unity/target-platform/unity-target-platform.ts';
import { IOptions } from './options-interface.ts';

export class BuildOptions implements IOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .demandOption('targetPlatform', 'Target platform is mandatory for builds')
      .option('buildName', {
        description: 'Name of the build (defaults to targetPlatform name)',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('buildsPath', {
        alias: 'o',
        description: 'Output folder for the builds',
        type: 'string',
        demandOption: false,
        default: 'build',
      })
      .default('buildPath', '')
      .default('buildFile', '')
      .middleware((argv: YargsArguments) => {
        const { buildName, buildsPath, targetPlatform, androidAppBundle } = argv;
        argv.buildName = buildName || targetPlatform;
        argv.buildPath = `${buildsPath}/${targetPlatform}`;
        argv.buildFile = UnityTargetPlatform.determineBuildFileName(buildName, targetPlatform, androidAppBundle);
      })
      .option('buildMethod', {
        alias: 'm',
        description: 'Build method to use',
        type: 'string',
        demandOption: false,
        default: 'UnityBuilderAction.Builder.BuildProject',
      })
      .option('dockerWorkspacePath', {
        description: String.dedent`The path to mount the workspace inside the docker container. For windows, leave out the drive letter. For example
        c:/github/workspace should be defined as /github/workspace`,
        type: 'string',
        demandOption: false,
        default: '/github/workspace',
      });
  }
}
