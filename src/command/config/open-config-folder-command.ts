import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import type { YargsInstance, YargsArguments } from '../../dependencies.ts';
import { getHomeDir } from '../../dependencies.ts';
import { exec } from 'node:child_process';

export class OpenConfigFolderCommand extends CommandBase implements CommandInterface {
  public async execute(options: YargsArguments): Promise<boolean> {
    const cliStoragePath = `${getHomeDir()}/.game-ci`;

    // Open folder using platform-appropriate command
    const openCommand =
      process.platform === 'win32' ? `start "" "${cliStoragePath}"` :
      process.platform === 'darwin' ? `open "${cliStoragePath}"` :
      `xdg-open "${cliStoragePath}"`;

    return new Promise((resolve) => {
      exec(openCommand, (err) => {
        if (err) {
          log.error(`Failed to open config folder: ${err.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {}
}
