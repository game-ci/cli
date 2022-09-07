import { yaml, yargs, YargsInstance, YargsArguments, getHomeDir, __dirname, path } from './dependencies.ts';
import { CommandInterface } from './command/command-interface.ts';
import { configureLogger } from './middleware/logger-verbosity/index.ts';
import { CommandFactory } from './command/command-factory.ts';
import { Engine } from './model/engine/engine.ts';
import { ProjectOptions } from './command-options/project-options.ts';
import { UnityBuildCommand } from './command/build/unity-build-command.ts';

export class Cli {
  private readonly yargs: YargsInstance;
  private readonly cliStorageAbsolutePath: string;
  private readonly cliStorageCanonicalPath: string;
  private readonly cliPath: string;
  private readonly cliDistPath: string;
  private readonly configFileName: string;
  private readonly currentWorkDir: string;
  private readonly isRunningLocally: boolean;
  private readonly hostPlatform: string | 'darwin' | 'linux' | 'win32';
  private command: CommandInterface;

  constructor(args: Deno.Args, cwd: string) {
    this.cliStorageAbsolutePath = `${getHomeDir()}/.game-ci`;
    this.cliStorageCanonicalPath = '~/.game-ci';
    this.yargs = yargs(args);
    this.currentWorkDir = cwd;
    this.isRunningLocally = !Boolean(Deno.env.get('CI'));
    this.hostPlatform = process.platform;

    // Todo make these variables portable when generating the cli binary
    this.cliPath = __dirname;
    this.cliDistPath = path.join(path.dirname(__dirname), 'dist');
  }

  public async validateAndParseArguments() {
    await this.registerConfigCommand();
    await this.registerBuildCommand();
    await this.registerRemoteCommand();

    if (log.isVeryVerbose) {
      console.log('cliPath', this.cliPath);
      console.log('distPath', this.cliDistPath);
    }

    await this.parse();

    return {
      command: this.command,
      options: this.options,
    };
  }

  public async configureLogger() {
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
  }

  public async configureGlobalSettings() {
    const defaultCanonicalPath = `${this.cliStorageCanonicalPath}/${this.configFileName}`;
    const defaultAbsolutePath = `${this.cliStorageAbsolutePath}/${this.configFileName}`;

    this.yargs
      .parserConfiguration({
        'dot-notation': false,
        'duplicate-arguments-array': false,
        'negation-prefix': false,
        'strip-aliased': true,
        'strip-dashed': true,
      })
      .fail(Cli.handleFailure)
      .help(false) // Fixes broken `_handle` in yargs 17.0.0
      .version(false) // Fixes broken `_handle` in yargs 17.0.0
      .showHelpOnFail(false) // Fixes broken `_handle` in yargs 17.0.0
      .epilogue('for more information, find our manual at https://game.ci/docs/cli')
      .middleware([])
      .exitProcess(true) // Fixes broken `_handle` in yargs 17.0.0
      .strict(true);

    // Todo - enable `.env()` after this is merged: https://github.com/yargs/yargs/pull/2231
    // this.yargs.env();
  }

  public async configureGlobalOptions() {
    this.yargs
      .config('config', `default: .game-ci.yml`, async (override: string) => {
        // Todo - remove hardcoded. Yargs override seems to be bugged though.
        const configPath = `${this.currentWorkDir}/.game-ci.yml`;
        // const configPath = override || defaultAbsolutePath;

        return this.loadConfig(configPath);
      })
      .default('cliPath', this.cliPath)
      .default('cliDistPath', this.cliDistPath)
      .default('currentWorkDir', this.currentWorkDir)
      .default('isRunningLocally', this.isRunningLocally)
      .default('hostPlatform', this.hostPlatform);
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

      // Todo - remove hardcoded command - ideally this lives inside middleware
      //   however, middleware runs while args are being parsed, which means
      //   that we can not add new options to the command during middleware time.
      await new UnityBuildCommand('test').configureOptions(yargs);
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

    if (log.isVeryVerbose) log.info('parsed:', _, $0, options);

    this.options = options;
  }

  private static handleFailure(message: string, error: Error, yargs: YargsInstance) {
    if (error) throw error;

    log.warning(message);
    Deno.exit(1);
  }

  private async loadConfig(configPath: string) {
    try {
      let configFile = await Deno.readTextFile(configPath);

      try {
        const jsonConfig = JSON.parse(configFile).cliOptions;
        if (log.isMaxVerbose) log.debug('jsonConfig', jsonConfig);

        return jsonConfig;
      } catch {
        const yamlConfig = yaml.parse(configFile).cliOptions;
        if (log.isMaxVerbose) log.debug('yamlConfig', yamlConfig);

        return yamlConfig;
      }
    } catch (error) {
      throw new Error(`Could not parse config file ${configPath}`);
    }
  }
}
