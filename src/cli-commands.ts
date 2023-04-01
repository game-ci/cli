import { YargsInstance } from './dependencies.ts';
import { ProjectOptions } from './command-options/project-options.ts';

/**
 * Register commands
 *
 * Bare minimum needed to register the commands. Any specific configuration (e.g. middleware) should be done from within
 * the command itself through `CommandInterface.configureOptions`.
 *
 * @param yargs the global yargs instance
 * @param register a function that registers the command. must be called from within the builder of each command.
 */
export class CliCommands {
  private readonly yargs: YargsInstance;
  private readonly register: (yargs: YargsInstance) => void;

  constructor(yargs: YargsInstance, register: (yargs: YargsInstance) => void) {
    this.yargs = yargs;
    this.register = register;
  }

  public async registerAll() {
    await this.configCommand();
    await this.testCommand();
    await this.buildCommand();
    await this.remoteCommands();

    // This is needed to run the engine and vcs detection middleware.
    // Their output is used to register the correct commands based on the detected engine and vcs.
    await this.yargs.parseAsync();
  }

  private async configCommand() {
    await this.yargs.command('config', 'GameCI CLI configuration', async (yargs: YargsInstance) => {
      yargs.command('open', 'Opens the CLI configuration folder', async (yargs: YargsInstance) => {});
      this.register(yargs);
    });
  }

  private async testCommand() {
    await this.yargs.command('test [projectPath]', 'Runs the tests of a given project', async (yargs: YargsInstance) => {
      ProjectOptions.preConfigure(yargs);
      this.register(yargs);
    });
  }

  private async buildCommand() {
    await this.yargs.command('build [projectPath]', 'Builds a given project', async (yargs: YargsInstance) => {
      ProjectOptions.preConfigure(yargs);
      this.register(yargs);
    });
  }

  private async remoteCommands() {
    await this.yargs.command('remote', 'Schedule jobs to be run remotely, in the cloud', async (yargs: YargsInstance) => {
      yargs
        .command('build [projectPath]', 'Schedule a build to be run remotely', async (yargs: YargsInstance) => {
          ProjectOptions.preConfigure(yargs);
          this.register(yargs);
        })
        .command('otherSubCommand', 'Other sub command', async (yargs: YargsInstance) => {
          // Todo - implement all subcommands
          ProjectOptions.preConfigure(yargs);
          this.register(yargs);
        });
    });
  }
}
