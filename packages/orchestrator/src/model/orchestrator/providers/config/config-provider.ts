import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import BuildParameters from '../../../build-parameters';
import OrchestratorEnvironmentVariable from '../../options/orchestrator-environment-variable';
import OrchestratorSecret from '../../options/orchestrator-secret';
import OrchestratorLogger from '../../services/core/orchestrator-logger';
import { ProviderInterface } from '../provider-interface';
import { ProviderResource } from '../provider-resource';
import { ProviderWorkflow } from '../provider-workflow';

type ConfigCommand =
  | string
  | {
      command: string;
      cwd?: string;
      shell?: string;
      allowFailure?: boolean;
    };

interface ConfigProviderDefinition {
  name?: string;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  commands?: Record<string, ConfigCommand>;
  lifecycle?: Record<string, ConfigCommand>;
}

interface ConfigProviderContext {
  buildGuid?: string;
  buildParameters?: BuildParameters;
  branchName?: string;
  defaultSecretsArray?: {
    ParameterKey: string;
    EnvironmentVariable: string;
    ParameterValue: string;
  }[];
  image?: string;
  commands?: string;
  mountdir?: string;
  workingdir?: string;
  environment?: OrchestratorEnvironmentVariable[];
  secrets?: OrchestratorSecret[];
  filter?: string;
  previewOnly?: boolean;
  olderThan?: number;
  fullCache?: boolean;
  baseDependencies?: boolean;
}

interface ConfigProviderSource {
  filePath: string;
  providerName?: string;
}

const COMMAND_ALIASES: Record<string, string[]> = {
  setupWorkflow: ['setupWorkflow', 'setup-workflow', 'setup'],
  cleanupWorkflow: ['cleanupWorkflow', 'cleanup-workflow', 'cleanup'],
  runTaskInWorkflow: ['runTaskInWorkflow', 'run-task', 'runTask', 'run'],
  garbageCollect: ['garbageCollect', 'garbage-collect', 'garbageCollectWorkflow'],
  listResources: ['listResources', 'list-resources', 'resources'],
  listWorkflow: ['listWorkflow', 'list-workflow', 'workflow'],
  watchWorkflow: ['watchWorkflow', 'watch-workflow', 'watch'],
};

export class ConfigProvider implements ProviderInterface {
  private definition: ConfigProviderDefinition;
  private configDirectory: string;

  constructor(
    source: ConfigProviderSource,
    private buildParameters: BuildParameters,
  ) {
    this.definition = ConfigProvider.loadDefinition(source);
    this.configDirectory = path.dirname(path.resolve(source.filePath));
  }

  setupWorkflow(
    buildGuid: string,
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: {
      ParameterKey: string;
      EnvironmentVariable: string;
      ParameterValue: string;
    }[],
  ): Promise<string> {
    this.buildParameters = buildParameters;

    return this.runLifecycleCommand('setupWorkflow', {
      buildGuid,
      buildParameters,
      branchName,
      defaultSecretsArray,
    });
  }

  cleanupWorkflow(
    buildParameters: BuildParameters,
    branchName: string,
    defaultSecretsArray: {
      ParameterKey: string;
      EnvironmentVariable: string;
      ParameterValue: string;
    }[],
  ): Promise<string> {
    this.buildParameters = buildParameters;

    return this.runLifecycleCommand('cleanupWorkflow', {
      buildParameters,
      branchName,
      defaultSecretsArray,
    });
  }

  runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: OrchestratorEnvironmentVariable[],
    secrets: OrchestratorSecret[],
  ): Promise<string> {
    return this.runLifecycleCommand('runTaskInWorkflow', {
      buildGuid,
      buildParameters: this.buildParameters,
      image,
      commands,
      mountdir,
      workingdir,
      environment,
      secrets,
    });
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    olderThan: number,
    fullCache: boolean,
    baseDependencies: boolean,
  ): Promise<string> {
    return this.runLifecycleCommand('garbageCollect', {
      buildParameters: this.buildParameters,
      filter,
      previewOnly,
      olderThan,
      fullCache,
      baseDependencies,
    });
  }

  async listResources(): Promise<ProviderResource[]> {
    const output = await this.runLifecycleCommand('listResources', {
      buildParameters: this.buildParameters,
    });

    return this.parseNamedItems(output).map((name) => {
      const resource = new ProviderResource();
      resource.Name = name;

      return resource;
    });
  }

  async listWorkflow(): Promise<ProviderWorkflow[]> {
    const output = await this.runLifecycleCommand('listWorkflow', {
      buildParameters: this.buildParameters,
    });

    return this.parseNamedItems(output).map((name) => {
      const workflow = new ProviderWorkflow();
      workflow.Name = name;

      return workflow;
    });
  }

  watchWorkflow(): Promise<string> {
    return this.runLifecycleCommand('watchWorkflow', {
      buildParameters: this.buildParameters,
    });
  }

  static fromFile(providerSource: string, buildParameters: BuildParameters): ConfigProvider {
    const source = ConfigProvider.parseSource(providerSource);

    return new ConfigProvider(source, buildParameters);
  }

  static isConfigProviderSource(providerSource: string): boolean {
    const normalized = providerSource.toLowerCase();

    return (
      normalized.startsWith('config:') ||
      normalized.endsWith('.yml') ||
      normalized.endsWith('.yaml') ||
      normalized.endsWith('.json') ||
      /\.ya?ml#.+$/i.test(providerSource) ||
      /\.json#.+$/i.test(providerSource)
    );
  }

  private async runLifecycleCommand(
    lifecycleName: keyof typeof COMMAND_ALIASES,
    context: ConfigProviderContext,
  ): Promise<string> {
    const command = this.getCommand(lifecycleName);
    if (!command) return '';

    return this.executeCommand(command, context);
  }

  private getCommand(lifecycleName: keyof typeof COMMAND_ALIASES): ConfigCommand | undefined {
    const commandMap = this.definition.lifecycle || this.definition.commands || {};

    for (const name of COMMAND_ALIASES[lifecycleName]) {
      const command = commandMap[name];
      if (command) return command;
    }

    return undefined;
  }

  private executeCommand(commandConfig: ConfigCommand, context: ConfigProviderContext) {
    const command = typeof commandConfig === 'string' ? commandConfig : commandConfig.command;
    const shell =
      typeof commandConfig === 'string'
        ? this.definition.shell
        : commandConfig.shell || this.definition.shell;
    const cwd = this.resolveCwd(
      typeof commandConfig === 'string'
        ? this.definition.cwd
        : commandConfig.cwd || this.definition.cwd,
      context,
    );
    const allowFailure =
      typeof commandConfig === 'string' ? false : commandConfig.allowFailure === true;
    const renderedCommand = this.renderTemplate(command, context);

    OrchestratorLogger.log(
      `[ConfigProvider] Running ${this.definition.name || 'configured provider'} command`,
    );

    return new Promise<string>((resolve, reject) => {
      exec(
        renderedCommand,
        {
          cwd,
          env: this.createEnvironment(context),
          maxBuffer: 1024 * 1024 * 20,
          shell,
        },
        (error, stdout, stderr) => {
          const output = `${stdout || ''}${stderr || ''}`;
          if (stderr) {
            OrchestratorLogger.logWarning(stderr);
          }
          if (error && !allowFailure) {
            reject(
              new Error(`Config provider command failed: ${error.message}\n${output}`.trim(), {
                cause: error,
              }),
            );

            return;
          }

          resolve(output);
        },
      );
    });
  }

  private createEnvironment(context: ConfigProviderContext): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...this.definition.env,
      GAME_CI_BUILD_GUID: context.buildGuid || '',
      GAME_CI_BRANCH_NAME: context.branchName || '',
      GAME_CI_IMAGE: context.image || '',
      GAME_CI_COMMANDS: context.commands || '',
      GAME_CI_MOUNT_DIR: context.mountdir || '',
      GAME_CI_WORKING_DIR: context.workingdir || '',
      GAME_CI_FILTER: context.filter || '',
      GAME_CI_PREVIEW_ONLY: String(context.previewOnly || false),
      GAME_CI_OLDER_THAN: String(context.olderThan || ''),
      GAME_CI_FULL_CACHE: String(context.fullCache || false),
      GAME_CI_BASE_DEPENDENCIES: String(context.baseDependencies || false),
      GAME_CI_BUILD_PARAMETERS_JSON: JSON.stringify(context.buildParameters || {}),
      GAME_CI_ENVIRONMENT_JSON: JSON.stringify(context.environment || []),
      GAME_CI_SECRETS_JSON: JSON.stringify(context.secrets || []),
      GAME_CI_DEFAULT_SECRETS_JSON: JSON.stringify(context.defaultSecretsArray || []),
    };

    for (const item of context.environment || []) {
      environment[item.name] = String(item.value);
    }

    for (const item of context.secrets || []) {
      environment[item.EnvironmentVariable] = String(item.ParameterValue);
    }

    return environment;
  }

  private resolveCwd(cwd: string | undefined, context: ConfigProviderContext): string {
    const renderedCwd = cwd ? this.renderTemplate(cwd, context) : this.configDirectory;
    if (path.isAbsolute(renderedCwd)) return renderedCwd;

    return path.resolve(this.configDirectory, renderedCwd);
  }

  private renderTemplate(template: string, context: ConfigProviderContext): string {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expression: string) => {
      const value = ConfigProvider.getPath(
        { ...context, env: this.createEnvironment(context) },
        expression,
      );

      if (value === undefined || value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value);

      return String(value);
    });
  }

  private parseNamedItems(output: string): string[] {
    const trimmed = output.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') return item.Name || item.name;

            return undefined;
          })
          .filter(Boolean);
      }
    } catch {
      // Fall back to one resource/workflow name per output line.
    }

    return trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private static parseSource(providerSource: string): ConfigProviderSource {
    const withoutPrefix = providerSource.startsWith('config:')
      ? providerSource.slice('config:'.length)
      : providerSource;
    const [filePath, providerName] = withoutPrefix.split('#', 2);

    if (!filePath) {
      throw new Error('Config provider source must include a file path');
    }

    return { filePath, providerName };
  }

  private static loadDefinition(source: ConfigProviderSource): ConfigProviderDefinition {
    const resolvedPath = path.resolve(source.filePath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed =
      extension === '.json'
        ? JSON.parse(raw)
        : (YAML.parse(raw) as Record<string, any> | undefined);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Config provider '${source.filePath}' must contain an object`);
    }

    const definition = ConfigProvider.selectDefinition(parsed, source);
    ConfigProvider.validateDefinition(definition, source.filePath);

    return definition;
  }

  private static selectDefinition(
    parsed: Record<string, any>,
    source: ConfigProviderSource,
  ): ConfigProviderDefinition {
    if (!parsed.providers) return parsed as ConfigProviderDefinition;

    const providers = parsed.providers;
    if (source.providerName) {
      const selected = providers[source.providerName];
      if (!selected) {
        throw new Error(
          `Config provider '${source.filePath}' does not define provider '${source.providerName}'`,
        );
      }

      return { name: source.providerName, ...selected };
    }

    const providerNames = Object.keys(providers);
    if (providerNames.length !== 1) {
      throw new Error(
        `Config provider '${source.filePath}' defines multiple providers. Select one with '#providerName'.`,
      );
    }

    return { name: providerNames[0], ...providers[providerNames[0]] };
  }

  private static validateDefinition(definition: ConfigProviderDefinition, filePath: string): void {
    if (!definition.lifecycle && !definition.commands) {
      throw new Error(
        `Config provider '${filePath}' must define a 'lifecycle' or 'commands' object`,
      );
    }

    const runCommand =
      definition.lifecycle?.runTaskInWorkflow ||
      definition.lifecycle?.['run-task'] ||
      definition.lifecycle?.runTask ||
      definition.lifecycle?.run ||
      definition.commands?.runTaskInWorkflow ||
      definition.commands?.['run-task'] ||
      definition.commands?.runTask ||
      definition.commands?.run;

    if (!runCommand) {
      throw new Error(
        `Config provider '${filePath}' must define a runTaskInWorkflow, run-task, runTask, or run command`,
      );
    }
  }

  private static getPath(source: Record<string, any>, expression: string): any {
    return expression
      .split('.')
      .map((part) => part.trim())
      .reduce((current, part) => (current == null ? undefined : current[part]), source);
  }
}

export default ConfigProvider;
