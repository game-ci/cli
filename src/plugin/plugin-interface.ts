import type { YargsInstance, YargsArguments } from '../dependencies.ts';
import { CommandInterface } from '../command/command-interface.ts';

/**
 * Engine detector provided by a plugin.
 * Returns engine name + version if the project matches, or null if not.
 */
export interface EngineDetectorPlugin {
  name: string;
  detect(projectPath: string): { engine: string; engineVersion: string } | null;
}

/**
 * Command provider from a plugin — maps engine commands (build, test, remote run, etc.)
 * to concrete implementations.
 */
export interface CommandPlugin {
  engine: string;
  createCommand(command: string, subCommands: string[]): CommandInterface | null;
}

/**
 * Options provider — a plugin can register additional yargs options.
 */
export interface OptionsPlugin {
  engine: string;
  configure(yargs: YargsInstance): Promise<void> | void;
}

/**
 * Provider plugin interface — compatible with unity-builder's ProviderInterface.
 * This is what orchestrator plugins (aws, k8s, local-docker, etc.) implement.
 */
export interface ProviderPlugin {
  cleanupWorkflow(buildParameters: any, branchName: string, defaultSecretsArray: any[]): any;
  setupWorkflow(buildGuid: string, buildParameters: any, branchName: string, defaultSecretsArray: any[]): any;
  runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: any[],
    secrets: any[],
  ): Promise<string>;
  garbageCollect(filter: string, previewOnly: boolean, olderThan: number, fullCache: boolean, baseDependencies: boolean): Promise<string>;
  listResources(): Promise<any[]>;
  listWorkflow(): Promise<any[]>;
  watchWorkflow(): Promise<string>;
}

/**
 * Full plugin manifest — a plugin can provide any combination of engines,
 * commands, options, and providers.
 */
export interface GameCIPlugin {
  name: string;
  version?: string;

  /** Engine detectors this plugin provides */
  engineDetectors?: EngineDetectorPlugin[];

  /** Command providers (keyed by engine name) */
  commands?: CommandPlugin[];

  /** Additional CLI options */
  options?: OptionsPlugin[];

  /** Provider constructors (e.g., aws, k8s) — keyed by strategy name */
  providers?: Record<string, new (buildParameters: any) => ProviderPlugin>;

  /** Lifecycle hook: called when the plugin is loaded */
  onLoad?(): Promise<void> | void;
}
