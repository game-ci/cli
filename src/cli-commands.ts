import type { YargsInstance } from "./dependencies.ts";
import { ProjectOptions } from "./command-options/project-options.ts";

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
    await this.activateCommand();
    await this.buildImageCommand();
    await this.orchestrateCommand();
    await this.remoteCommands();
    await this.deployCommand();
    await this.testRuntimeCommand();

    // This is needed to run the engine and vcs detection middleware.
    // Their output is used to register the correct commands based on the detected engine and vcs.
    await this.yargs.parseAsync();
  }

  private async configCommand() {
    await this.yargs.command("config", "GameCI CLI configuration", async (yargs: YargsInstance) => {
      yargs.command("open", "Opens the CLI configuration folder", async (yargs: YargsInstance) => {});
      this.register(yargs);
    });
  }

  private async testCommand() {
    await this.yargs.command(
      "test [projectPath]",
      "Runs the tests of a given project",
      async (yargs: YargsInstance) => {
        ProjectOptions.preConfigure(yargs);
        this.register(yargs);
      },
    );
  }

  private async buildCommand() {
    await this.yargs.command("build [projectPath]", "Builds a given project", async (yargs: YargsInstance) => {
      ProjectOptions.preConfigure(yargs);
      this.register(yargs);
    });
  }

  private async activateCommand() {
    await this.yargs.command(
      "activate [projectPath]",
      "Activates a license, leaving it active for a later step",
      async (yargs: YargsInstance) => {
        ProjectOptions.preConfigure(yargs);
        this.register(yargs);
      },
    );
  }

  private async buildImageCommand() {
    await this.yargs.command(
      "build-unity-image [baseOs] [modules]",
      "Build a Unity editor Docker image with specified modules",
      async (yargs: YargsInstance) => {
        this.register(yargs);
      },
    );
  }

  private async orchestrateCommand() {
    await this.yargs.command(
      "orchestrate [projectPath]",
      "Run an engine job through a provider plugin",
      async (yargs: YargsInstance) => {
        ProjectOptions.preConfigure(yargs);
        this.register(yargs);
      },
    );
  }

  private async deployCommand() {
    // Deliberately generic - core doesn't know the names of any specific
    // deploy targets (steam, itch, etc). <target> is resolved to a concrete
    // command by whichever deploy plugin is loaded, via PluginRegistry's '*'
    // engine wildcard - see CommandFactory.
    await this.yargs.command(
      "deploy <target> [buildPath]",
      "Deploy a pre-built output to a distribution target",
      async (yargs: YargsInstance) => {
        this.register(yargs);
      },
    );
  }

  private async testRuntimeCommand() {
    // Also engine-independent, and unlike deploy has no sub-target to
    // dispatch on - a single plugin (or none) handles it, via the '*'
    // engine wildcard in PluginRegistry.
    await this.yargs.command(
      "test-runtime [buildPath]",
      "Run tests against an already-built player executable",
      async (yargs: YargsInstance) => {
        this.register(yargs);
      },
    );
  }

  private async remoteCommands() {
    await this.yargs.command("remote", false, async (yargs: YargsInstance) => {
      yargs
        .command("run [projectPath]", false, async (yargs: YargsInstance) => {
          ProjectOptions.preConfigure(yargs);
          this.register(yargs);
        })
        .command("build [projectPath]", false, async (yargs: YargsInstance) => {
          ProjectOptions.preConfigure(yargs);
          this.register(yargs);
        })
        .command("otherSubCommand", "Other sub command", async (yargs: YargsInstance) => {
          // Todo - implement all subcommands
          ProjectOptions.preConfigure(yargs);
          this.register(yargs);
        });
    });
  }
}
