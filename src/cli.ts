import { yaml, yargs, getHomeDir, __dirname, path, process, fs } from './dependencies.ts';
import type { YargsInstance, YargsArguments } from './dependencies.ts';
import { CommandInterface } from './command/command-interface.ts';
import { configureLogger } from './middleware/logger-verbosity/index.ts';
import { CommandFactory } from './command/command-factory.ts';
import { NonExistentCommand } from './command/null/non-existent-command.ts';
import { CliCommands } from './cli-commands.ts';
import { PluginRegistry } from './plugin/plugin-registry.ts';
import { PluginLoader } from './plugin/plugin-loader.ts';
import { unityPlugin } from './plugin/builtin/unity-plugin.ts';
import { godotPlugin } from './plugin/builtin/godot-plugin.ts';
import { unrealPlugin } from './plugin/builtin/unreal-plugin.ts';

export class Cli {
  private readonly yargs: ReturnType<typeof yargs>;
  private readonly cliStoragePath: string;
  private readonly cliStorageCanonicalPath: string;
  private readonly cliPath: string;
  private readonly cliDistPath: string;
  private readonly configFileName!: string;
  private readonly currentWorkDir: string;
  private readonly homeDir: string;
  private readonly isRunningLocally: boolean;
  private readonly hostPlatform: string;
  private readonly hostOS: string;
  private command: CommandInterface;

  constructor(args: string[], cwd: string) {
    this.yargs = yargs(args);
    this.currentWorkDir = cwd;
    this.configFileName = '.game-ci.yml';

    this.homeDir = getHomeDir() || '';
    this.cliStoragePath = `${this.homeDir}/.game-ci`;
    this.cliStorageCanonicalPath = '~/.game-ci';
    this.isRunningLocally = !Boolean(process.env.CI);
    this.command = new NonExistentCommand('non-existent');
    this.hostPlatform = process.platform;
    this.hostOS = process.platform === 'win32' ? 'windows' : process.platform;

    // Todo make these variables portable when generating the cli binary
    this.cliPath = __dirname;
    this.cliDistPath = path.join(path.dirname(__dirname), 'dist');
  }

  public async setup() {
    await this.configureLogger();
    await this.configureGlobalSettings();
    await this.configureGlobalOptions();
    await this.loadPlugins();
  }

  private async loadPlugins() {
    await PluginRegistry.registerOnce(unityPlugin);
    await PluginRegistry.registerOnce(godotPlugin);
    await PluginRegistry.registerOnce(unrealPlugin);

    const options = await this.getPreCommandOptions();
    const pluginSources = this.getPluginSources(options);
    if (pluginSources.length === 0) {
      return;
    }

    await PluginLoader.loadAll(pluginSources);
  }

  public async registerCommands() {
    await this.nonStrict(async () => {
      const register = (yargs: any) => yargs.middleware([this.registerCommand.bind(this)]);
      await new CliCommands(this.yargs as any, register).registerAll();
      await this.yargs.parseAsync();
    });
  }

  public async registerSchemaForChosenCommand() {
    await this.command.configureOptions(this.yargs as any);
  }

  public async validateAndParseArguments() {
    // Parsing may happen many times before this point as well.
    const options = await this.finalParse();

    if (log.isVeryVerbose) {
      console.log('cliPath', this.cliPath);
      console.log('distPath', this.cliDistPath);
    }

    return {
      command: this.command,
      options,
    };
  }

  private async configureLogger() {
    await this.nonStrict(async () => {
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
    });
  }

  protected configureGlobalSettings() {
    const defaultCanonicalPath = `${this.cliStorageCanonicalPath}/${this.configFileName}`;


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

      // Deliberately not using yargs' blanket .env(): combined with strict(true)
      // it treats every process env var (not just game-ci-relevant ones) as an
      // unrecognized argument and fails. Secret-bearing options set their own
      // env fallback in their .option() default instead - see unityEmail etc.
      // in unity-options.ts.
  }

  protected configureGlobalOptions() {
    const defaultAbsolutePath = `${this.cliStoragePath}/${this.configFileName}`;
    this.yargs
      .option('plugin', {
        description:
          'Load an external plugin from npm, a local path, github:<repo>, or executable:<path>',
        type: 'string',
        array: true,
      })
      .option('plugins', {
        description: 'Alias for --plugin to support config-driven plugin arrays',
        type: 'string',
        array: true,
      })
      .config('config', `default: .game-ci.yml`, (override: string) => {
        // Todo - remove hardcoded. Yargs override seems to be bugged though.
        //const configPath = `${this.currentWorkDir}/.game-ci.yml`;
        const configPath = override || defaultAbsolutePath;

        return this.loadConfig(configPath);
      })
      .default('homeDir', this.homeDir)
      .default('currentWorkDir', this.currentWorkDir)
      .default('cliPath', this.cliPath)
      .default('cliDistPath', this.cliDistPath)
      .default('cliStoragePath', this.cliStoragePath)
      .default('isRunningLocally', this.isRunningLocally)
      .default('hostPlatform', this.hostPlatform)
      .default('hostOS', this.hostOS);
  }

  private async getPreCommandOptions() {
    let options: Record<string, unknown> = {};

    await this.nonStrict(async () => {
      options = await this.finalParse();
    });

    return options;
  }

  private getPluginSources(options: Record<string, unknown>): string[] {
    const configOptions = this.getConfigOptions(options);
    const sources = [
      ...this.normalizePluginOption(configOptions.plugin),
      ...this.normalizePluginOption(configOptions.plugins),
      ...this.normalizePluginOption(options.plugin),
      ...this.normalizePluginOption(options.plugins),
    ];

    return Array.from(new Set(sources));
  }

  private getConfigOptions(options: Record<string, unknown>): Record<string, unknown> {
    const explicitConfigPath = typeof options.config === 'string' ? options.config : '';
    const configPath = explicitConfigPath || path.join(this.currentWorkDir, this.configFileName);

    return this.loadConfig(configPath);
  }

  private normalizePluginOption(value: unknown): string[] {
    if (typeof value === 'string') {
      return value.trim() ? [value.trim()] : [];
    }

    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return [];
  }

  private registerCommand(args: YargsArguments) {
    const { engine, engineVersion, _: command } = args;
    const commandCast = command as string[];
    this.command = new CommandFactory().selectEngine(engine, engineVersion).createCommand(commandCast);
  }

  protected async finalParse() {
    const { _, $0, ...options } = await this.yargs.parseAsync();

    if (log.isVeryVerbose) log.info('parsed:', _, $0, options);

    return options;
  }

  protected static handleFailure(message: string, error: Error, yargs: any) {
    if (error) throw error;

    log.warning(message);
    process.exit(1);
  }

  protected loadConfig(configPath: string) {
    try {
      const { readFileSync } = require('node:fs');
      const configFile = readFileSync(configPath, 'utf-8');

      try {
        const jsonConfig = JSON.parse(configFile).cliOptions;
        if (log.isMaxVerbose) log.debug('jsonConfig', jsonConfig);

        return jsonConfig;
      } catch {
        const yamlConfigRaw = yaml.parse(configFile) as any;
        const yamlConfig = yamlConfigRaw.cliOptions;
        if (log.isMaxVerbose) log.debug('yamlConfig', yamlConfig);

        return yamlConfig;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }

      throw new Error(`Could not parse config file ${configPath}`);
    }
  }

  protected async nonStrict(fn: () => void) {
    const previousStrict = this.yargs.getStrict();
    this.yargs.strict(false);
    await fn();
    this.yargs.strict(previousStrict);
  }
}
