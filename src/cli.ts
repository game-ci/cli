import { yaml, yargs, getHomeDir, __dirname, isCompiledBinary, path, process, fs } from "./dependencies.ts";
import type { YargsInstance, YargsArguments } from "./dependencies.ts";
import { CommandInterface } from "./command/command-interface.ts";
import { configureLogger } from "./middleware/logger-verbosity/index.ts";
import { CommandFactory } from "./command/command-factory.ts";
import { NonExistentCommand } from "./command/null/non-existent-command.ts";
import { CliCommands } from "./cli-commands.ts";
import { PluginRegistry } from "./plugin/plugin-registry.ts";
import { PluginLoader } from "./plugin/plugin-loader.ts";
import { unityPlugin } from "./plugin/builtin/unity-plugin.ts";
import { godotPlugin } from "./plugin/builtin/godot-plugin.ts";
import { unrealPlugin } from "./plugin/builtin/unreal-plugin.ts";

export class Cli {
  private readonly yargs: ReturnType<typeof yargs>;
  private readonly cliStoragePath: string;
  private readonly cliStorageCanonicalPath: string;
  private readonly cliPath: string;
  private readonly cliDistPath: string;
  private readonly configFileName!: string;
  private readonly rawArgs: string[];
  private readonly currentWorkDir: string;
  private readonly homeDir: string;
  private readonly isRunningLocally: boolean;
  private readonly hostPlatform: string;
  private readonly hostOS: string;
  private command: CommandInterface;

  constructor(args: string[], cwd: string) {
    this.yargs = yargs(args);
    this.rawArgs = args;
    this.currentWorkDir = cwd;
    this.configFileName = ".game-ci.yml";

    this.homeDir = getHomeDir() || "";
    this.cliStoragePath = `${this.homeDir}/.game-ci`;
    this.cliStorageCanonicalPath = "~/.game-ci";
    this.isRunningLocally = !Boolean(process.env.CI);
    this.command = new NonExistentCommand("non-existent");
    this.hostPlatform = process.platform;
    this.hostOS = process.platform === "win32" ? "windows" : process.platform;

    this.cliPath = __dirname;
    // Dev mode: __dirname is <repo>/src, so dist/ is a sibling of its parent
    // (<repo>/dist). Compiled binary: __dirname is wherever the standalone
    // executable itself sits on disk (no src/ nesting) - dist/ must be
    // shipped as its direct sibling instead. See game-ci/cli#73.
    this.cliDistPath = isCompiledBinary ? path.join(__dirname, "dist") : path.join(path.dirname(__dirname), "dist");
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

    // Orchestrator is a genuinely separate package (plugins/orchestrator),
    // not core-internal like unity/godot/unreal above (which live inside
    // src/plugin/builtin/ itself). "Built-in" here just means "always in
    // the default load list", not "statically imported": the package is
    // still resolved by its public name/exports (@game-ci/orchestrator/cli-plugin),
    // never a relative path into its src/ tree.
    //
    // These use literal `import()` expressions (not PluginLoader.load's
    // string-parameter path) because Bun's --compile bundler can only trace
    // a dynamic import whose specifier is a source-level string literal at
    // the call site - `import(variable)` inside a shared helper resolves
    // fine under `bun run`/`bun test` but throws "Cannot find module" in
    // the compiled standalone binary the moment a real command needs a
    // plugin (never during --help, which doesn't reach this code path).
    // See game-ci/cli#151.
    await PluginLoader.loadModule(
      await import("@game-ci/orchestrator/cli-plugin"),
      "@game-ci/orchestrator/cli-plugin",
    );
    await PluginLoader.loadModule(await import("@game-ci/steam-deploy"), "@game-ci/steam-deploy");
    await PluginLoader.loadModule(
      await import("@game-ci/runtime-test-framework"),
      "@game-ci/runtime-test-framework",
    );

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
      console.log("cliPath", this.cliPath);
      console.log("distPath", this.cliDistPath);
    }

    return {
      command: this.command,
      options,
    };
  }

  private async configureLogger() {
    await this.nonStrict(async () => {
      await this.yargs
        .options("quiet", {
          alias: "q",
          description: "Suppress all output",
          type: "boolean",
          demandOption: false,
          default: false,
        })
        .options("verbose", {
          alias: "v",
          description: "Enable verbose logging",
          type: "boolean",
          demandOption: false,
          default: false,
        })
        .options("veryVerbose", {
          alias: "vv",
          description: "Enable very verbose logging",
          type: "boolean",
          demandOption: false,
          default: false,
        })
        .options("maxVerbose", {
          alias: "vvv",
          description: "Enable debug logging",
          demandOption: false,
          type: "boolean",
          default: false,
        })
        .default([{ logLevel: "placeholder" }, { logLevelName: "placeholder" }])
        .middleware([configureLogger], true)
        .parseAsync();
    });
  }

  protected configureGlobalSettings() {
    const defaultCanonicalPath = `${this.cliStorageCanonicalPath}/${this.configFileName}`;

    this.yargs
      .parserConfiguration({
        "dot-notation": false,
        "duplicate-arguments-array": false,
        "negation-prefix": false,
        "strip-aliased": true,
        "strip-dashed": true,
      })
      .fail(Cli.handleFailure)
      .help(false) // Fixes broken `_handle` in yargs 17.0.0
      .version(false) // Fixes broken `_handle` in yargs 17.0.0
      .showHelpOnFail(false) // Fixes broken `_handle` in yargs 17.0.0
      .epilogue("for more information, find our manual at https://game.ci/docs/cli")
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
      .option("plugin", {
        description: "Load an external plugin from npm, a local path, github:<repo>, or executable:<path>",
        type: "string",
        array: true,
      })
      .option("plugins", {
        description: "Alias for --plugin to support config-driven plugin arrays",
        type: "string",
        array: true,
      })
      .option("profile", {
        description: "Select a named build profile from the profiles: map in the config file",
        type: "string",
        demandOption: false,
      })
      .config("config", `default: .game-ci.yml`, (override: string) => {
        // Todo - remove hardcoded. Yargs override seems to be bugged though.
        //const configPath = `${this.currentWorkDir}/.game-ci.yml`;
        const configPath = override || defaultAbsolutePath;

        return this.loadConfig(configPath);
      })
      .default("homeDir", this.homeDir)
      .default("currentWorkDir", this.currentWorkDir)
      .default("cliPath", this.cliPath)
      .default("cliDistPath", this.cliDistPath)
      .default("cliStoragePath", this.cliStoragePath)
      .default("isRunningLocally", this.isRunningLocally)
      .default("hostPlatform", this.hostPlatform)
      .default("hostOS", this.hostOS);
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
    const explicitConfigPath = typeof options.config === "string" ? options.config : "";
    const configPath = explicitConfigPath || path.join(this.currentWorkDir, this.configFileName);

    return this.loadConfig(configPath);
  }

  private normalizePluginOption(value: unknown): string[] {
    if (typeof value === "string") {
      return value.trim() ? [value.trim()] : [];
    }

    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return [];
  }

  private registerCommand(args: YargsArguments) {
    const { engine, engineVersion, _: command, target } = args;
    const commandCast = command as string[];
    // `deploy <target> [buildPath]`'s <target> is a named yargs positional
    // (e.g. args.target === 'steam'), not part of `_` - yargs only puts
    // bare, undeclared trailing tokens into `_`. Fold it back in so
    // CommandFactory's [command, ...subCommands] dispatch still sees it as
    // subCommands[0], exactly as if it actually were the second `_` entry.
    const fullCommand = target ? [...commandCast, target as string] : commandCast;
    this.command = new CommandFactory().selectEngine(engine, engineVersion).createCommand(fullCommand);
  }

  protected async finalParse() {
    const { _, $0, ...options } = await this.yargs.parseAsync();

    if (log.isVeryVerbose) log.info("parsed:", _, $0, options);

    return options;
  }

  protected static handleFailure(message: string, error: Error, yargs: any) {
    if (error) throw error;

    log.warning(message);
    process.exit(1);
  }

  protected loadConfig(configPath: string) {
    let rootConfig: any;

    try {
      const { readFileSync } = require("node:fs");
      const configFile = readFileSync(configPath, "utf-8");

      try {
        rootConfig = JSON.parse(configFile);
        if (log.isMaxVerbose) log.debug("jsonConfig", rootConfig?.cliOptions);
      } catch {
        rootConfig = yaml.parse(configFile) as any;
        if (log.isMaxVerbose) log.debug("yamlConfig", rootConfig?.cliOptions);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }

      throw new Error(`Could not parse config file ${configPath}`);
    }

    return this.resolveCliOptions(rootConfig, configPath);
  }

  // Merges the base `cliOptions:` block with the selected `--profile`'s
  // overrides (profile wins on key conflicts) *before* handing the result
  // back to yargs' .config() callback. This keeps yargs' own (already
  // correct) precedence between config-sourced values and explicit CLI
  // flags intact - explicit flags still win over whatever this returns.
  private resolveCliOptions(rootConfig: any, configPath: string): Record<string, unknown> {
    const cliOptions = (rootConfig?.cliOptions ?? {}) as Record<string, unknown>;
    const profiles = (rootConfig?.profiles ?? {}) as Record<string, unknown>;
    const profileName = this.getRequestedProfileName();

    if (!profileName) {
      return cliOptions;
    }

    if (!Object.prototype.hasOwnProperty.call(profiles, profileName)) {
      const availableProfiles = Object.keys(profiles);
      const availableList = availableProfiles.length > 0 ? availableProfiles.join(", ") : "(no profiles defined)";

      throw new Error(
        `Unknown profile "${profileName}" passed via --profile. ` +
          `Available profiles in ${configPath}: ${availableList}`,
      );
    }

    const profileOptions = profiles[profileName] as Record<string, unknown>;

    return { ...cliOptions, ...profileOptions };
  }

  // --profile is read directly from the raw argv rather than from a parsed
  // yargs result: this method is called from inside the yargs .config()
  // callback, which only receives the resolved "config" value - not the
  // rest of the parsed argv - so we can't rely on yargs having parsed
  // --profile yet at this point.
  private getRequestedProfileName(): string | undefined {
    for (let index = 0; index < this.rawArgs.length; index++) {
      const arg = this.rawArgs[index];

      if (arg === "--profile") {
        return this.rawArgs[index + 1];
      }

      if (arg?.startsWith("--profile=")) {
        return arg.slice("--profile=".length);
      }
    }

    return undefined;
  }

  protected async nonStrict(fn: () => void) {
    const previousStrict = this.yargs.getStrict();
    this.yargs.strict(false);
    await fn();
    this.yargs.strict(previousStrict);
  }
}
