import { yargs, YargsInstance, YargsArguments, getHomeDir, __dirname, path } from './dependencies.ts';
import { CommandInterface } from './command/command-interface.ts';
import { configureLogger } from './middleware/logger-verbosity/index.ts';
import { CommandFactory } from './command/command-factory.ts';
import { Engine } from './model/engine/engine.ts';
import { ProjectOptions } from './command-options/project-options.ts';

export class Cli {
  private readonly yargs: YargsInstance;
  private readonly cliStorageAbsolutePath: string;
  private readonly cliStorageCanonicalPath: string;
  private readonly cliPath: string;
  private readonly distPath: string;
  private readonly configFileName: string;
  private command: CommandInterface;

  constructor(args: Deno.Args) {
    this.rawArgs = args;

    this.cliStorageAbsolutePath = `${getHomeDir()}/.game-ci`;
    this.cliStorageCanonicalPath = '~/.game-ci';
    this.configFileName = 'config.json';
    this.yargs = yargs(args);

    // Todo make these variables portable when generating the cli binary
    this.cliPath = __dirname;
    this.distPath = path.join(path.dirname(__dirname), 'dist');
  }

  public async validateAndParseArguments() {
    await this.registerConfigCommand();
    await this.registerBuildCommand();
    await this.registerRemoteCommand();

    if (log.isVeryVerbose) {
      console.log('cliPath', this.cliPath);
      console.log('distPath', this.distPath);
    }

    await this.parse();

    if (log.isVeryVerbose) {
      log.debug(`Parsed command: ${this.command.name} (${this.command.constructor.name})`);
      log.debug(`Parsed arguments: ${JSON.stringify(this.options, null, 2)}`);
    }

    return {
      command: this.command,
      options: this.options,
    };
  }

  public async configureGlobalSettings() {
    const defaultCanonicalPath = `${this.cliStorageCanonicalPath}/${this.configFileName}`;
    const defaultAbsolutePath = `${this.cliStorageAbsolutePath}/${this.configFileName}`;

    this.yargs
      .config('config', `default: ${defaultCanonicalPath}`, async (override: string) => {
        const configPath = override || defaultAbsolutePath;

        return JSON.parse(await Deno.readTextFile(configPath));
      })
      .parserConfiguration({
        'dot-notation': false,
        'duplicate-arguments-array': false,
        'negation-prefix': false,
        'strip-aliased': true,
        'strip-dashed': true,
      });

    // Todo - enable `.env()` after this is merged: https://github.com/yargs/yargs/pull/2231
    // this.yargs.env();
  }

  public async configureLogger(): this {
    await this.yargs
      .options('quiet', {
        alias: 'q',
        description: 'Suppress all output',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .options('verbose', {
        alias: 'v',
        description: 'Enable verbose logging',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .options('veryVerbose', {
        alias: 'vv',
        description: 'Enable very verbose logging',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .options('maxVerbose', {
        alias: 'vvv',
        description: 'Enable debug logging',
        demandOption: false,
        type: 'boolean',
        default: false,
      })
      .default([{ logLevel: 'placeholder' }, { logLevelName: 'placeholder' }])
      .middleware([configureLogger], true)
      .parseAsync();

    return this;
  }

  public async configureGlobalOptions() {
    this.yargs
      .fail(Cli.handleFailure)
      .help(false) // Fixes broken `_handle` in yargs 17.0.0
      .version(false) // Fixes broken `_handle` in yargs 17.0.0
      .showHelpOnFail(false) // Fixes broken `_handle` in yargs 17.0.0
      .epilogue('for more information, find our manual at https://game.ci/docs/cli')
      .middleware([])
      .exitProcess(true) // Fixes broken `_handle` in yargs 17.0.0
      .strict(true);
  }

  private async registerBuildCommand() {
    this.yargs.command('build [projectPath]', 'Builds a project that you want to build', async (yargs) => {
      ProjectOptions.configure(yargs);

      yargs
        // Todo - remove these lines with release 3.0.0
        .option('unityVersion', {
          describe: 'Override the engine version to be used',
          type: 'string',
          default: '',
        })
        .deprecateOption('unityVersion', 'This parameter will be removed. Use engineVersion instead')
        .middleware(
          [
            async (args) => {
              if (!args.unityVersion || args.unityVersion === 'auto' || args.engine !== Engine.unity) return;

              args.engineVersion = args.unityVersion;
              args.unityVersion = undefined;
            },
          ],
          true,
        )

        // End todo
        .middleware([async (args) => this.registerCommand(args, yargs)]);
    });
  }

  private registerRemoteCommand() {
    this.yargs.command('remote', 'Schedule jobs to be run remotely, in the cloud', async (yargs) => {
      yargs
        .command('build [projectPath]', 'Schedule a build to be run remotely', async (yargs) => {
          ProjectOptions.configure(yargs);
          yargs.middleware([async (args) => this.registerCommand(args, yargs)]);
        })
        .command('otherSubCommand', 'Other sub command', async (yargs) => {
          // Todo - implement all subcommands
          yargs.middleware([async (args) => this.registerCommand(args, yargs)]);
        });
    });
  }

  private async registerConfigCommand() {
    this.yargs.command('config', 'GameCI CLI configuration', async (yargs: YargsInstance) => {
      yargs
        .command('open', 'Opens the CLI configuration folder', async (yargs: YargsInstance) => {})
        .middleware([async (args) => this.registerCommand(args, yargs)]);
    });
  }

  private async registerCommand(args: YargsArguments, yargs: YargsInstance) {
    const { engine, engineVersion, _: command } = args;

    this.command = new CommandFactory().selectEngine(engine, engineVersion).createCommand(command);

    await this.command.configureOptions(yargs);
  }

  private async parse() {
    const { _, $0, ...options } = await this.yargs.parseAsync();

    this.options = options;
  }

  private static handleFailure(message: string, error: Error, yargs: YargsInstance) {
    if (error) throw error;

    log.warning(message);
    Deno.exit(1);
  }
}
