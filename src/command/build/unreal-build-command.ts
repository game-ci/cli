import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import type { YargsInstance, YargsArguments } from '../../dependencies.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';

export class UnrealBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    const projectPath = (options.projectPath as string) || '.';
    const targetPlatform = (options.targetPlatform as string) || 'Linux';
    const buildConfig = (options.buildConfig as string) || 'Shipping';
    const customImage = options.customImage as string;

    if (!customImage) {
      throw new Error(
        'Unreal Engine builds require a custom Docker image. ' +
          'Use --custom-image to specify your UE image (e.g., ghcr.io/epicgames/unreal-engine:5.4).',
      );
    }

    log.info(`Building Unreal project at ${projectPath}`);
    log.info(`Using image: ${customImage}`);
    log.info(`Target platform: ${targetPlatform}, Config: ${buildConfig}`);

    const { Docker } = await import('../../model/index.ts');
    await Docker.run(customImage, {
      ...options,
      commands: [
        // RunUAT.sh is the standard Unreal Automation Tool entry point
        '/home/ue4/UnrealEngine/Engine/Build/BatchFiles/RunUAT.sh',
        'BuildCookRun',
        `-project=/build/${projectPath}`,
        `-targetplatform=${targetPlatform}`,
        `-clientconfig=${buildConfig}`,
        '-build',
        '-cook',
        '-stage',
        '-pak',
        '-archive',
        '-archivedirectory=/build/output',
        '-noP4',
        '-unattended',
      ].join(' '),
    });

    return false;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    yargs.option('targetPlatform', {
      alias: 'target-platform',
      describe: 'UE target platform',
      type: 'string',
      default: 'Linux',
    });
    yargs.option('buildConfig', {
      alias: 'build-config',
      describe: 'UE build configuration (Development, Shipping, etc.)',
      type: 'string',
      default: 'Shipping',
    });
    yargs.option('customImage', {
      alias: 'custom-image',
      describe: 'Docker image for UE builds (required)',
      type: 'string',
    });
  }
}
