import type { YargsArguments, YargsInstance } from '../dependencies.ts';
import { UnityTargetPlatform } from '../model/unity/target-platform/unity-target-platform.ts';
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
        const { buildName, buildsPath, targetPlatform, androidAppBundle, androidExportType } = argv;
        const resolvedBuildName = buildName || targetPlatform;
        const resolvedAndroidExportType = androidExportType || (androidAppBundle ? 'androidAppBundle' : 'androidPackage');
        argv.buildName = resolvedBuildName;
        argv.buildPath = `${buildsPath}/${targetPlatform}`;
        argv.buildFile = UnityTargetPlatform.determineBuildFileName(
          resolvedBuildName,
          targetPlatform,
          resolvedAndroidExportType,
        );
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
      })
      .option('manualExit', {
        description: String.dedent`Skip passing -quit to the Unity editor, so it stays open after the build method returns.
        Use this if your build method needs to run further code in play mode before exiting (see
        https://github.com/game-ci/cli/issues/13). Your build method must call EditorApplication.Exit(0) itself,
        otherwise the build will hang until it times out.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      });
  }
}
