import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import type { YargsInstance, YargsArguments } from '../../dependencies.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';

export class GodotBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    const projectPath = (options.projectPath as string) || '.';
    const exportPreset = (options.exportPreset as string) || 'Linux/X11';
    const outputPath = (options.outputPath as string) || 'build/game';
    const godotImage = (options.customImage as string) || `barichello/godot-ci:${options.engineVersion || '4.3'}`;

    log.info(`Building Godot project at ${projectPath}`);
    log.info(`Using image: ${godotImage}`);
    log.info(`Export preset: ${exportPreset}`);

    const { Docker } = await import('../../model/index.ts');
    await Docker.run(godotImage, {
      ...options,
      commands: `godot --headless --verbose --export-release "${exportPreset}" ${outputPath}`,
    });

    return false;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    yargs.option('exportPreset', {
      alias: 'export-preset',
      describe: 'Godot export preset name',
      type: 'string',
      default: 'Linux/X11',
    });
    yargs.option('outputPath', {
      alias: 'output-path',
      describe: 'Build output path',
      type: 'string',
      default: 'build/game',
    });
  }
}
