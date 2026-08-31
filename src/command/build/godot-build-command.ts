import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import type { YargsInstance, YargsArguments } from '../../dependencies.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';
import { path, fsSync as fs } from '../../dependencies.ts';

export class GodotBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    const projectPath = (options.projectPath as string) || '.';
    const exportPreset = (options.exportPreset as string) || 'Linux/X11';
    const outputPath = (options.outputPath as string) || 'build/game';
    const godotImage = (options.customImage as string) || `barichello/godot-ci:${options.engineVersion || '4.3'}`;
    // Docker.run defaults an unset dockerWorkspacePath to this same value
    // (see src/model/docker.ts) - match it here so --path always points at
    // where the project is actually mounted in the container.
    const containerProjectPath = (options.dockerWorkspacePath as string) || '/github/workspace';

    log.info(`Building Godot project at ${projectPath}`);
    log.info(`Using image: ${godotImage}`);

    // export_presets.cfg is commonly untracked (it can carry
    // machine-specific paths/keystore locations - much like a .env file),
    // so plenty of real, otherwise-buildable Godot projects don't have one
    // checked in. Exporting without one fails outright with no useful
    // signal, so fall back to `--import` (validates the project actually
    // opens/imports cleanly) instead of a hard failure - the same
    // accommodation this repo's own engine-smoke-test.yml already made by
    // hand for its Godot fixture, now built into the command itself.
    const hasExportPresets = fs.existsSync(path.join(projectPath, 'export_presets.cfg'));

    const { Docker } = await import('../../model/index.ts');

    if (hasExportPresets) {
      log.info(`Export preset: ${exportPreset}`);
      await log.group('Godot export', async () => {
        await Docker.run(godotImage, {
          ...options,
          commands: `godot --headless --verbose --path ${containerProjectPath} --export-release "${exportPreset}" ${outputPath}`,
        });
      });
    } else {
      log.info('No export_presets.cfg found - validating the project imports cleanly instead of exporting.');
      await log.group('Godot import validation', async () => {
        // --path is required here: without it, --import doesn't reliably
        // resolve the project from the container's working directory, and
        // Godot falls through to its default run-mode instead of import-only
        // - which then fails with "Can't run project: no main scene defined"
        // even on projects that do declare one (game-ci/cli, real-project
        // smoke test against godotengine/godot-demo-projects).
        await Docker.run(godotImage, {
          ...options,
          commands: `godot --headless --verbose --path ${containerProjectPath} --import`,
        });
      });
    }

    return true;
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
