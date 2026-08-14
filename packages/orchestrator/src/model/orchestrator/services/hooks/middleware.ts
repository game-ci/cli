import OrchestratorSecret from '../../options/orchestrator-secret';

/**
 * Trigger conditions that determine when a middleware activates.
 * All specified conditions must be true (AND logic).
 */
export interface MiddlewareTrigger {
  /** Pipeline phases this middleware applies to: 'setup', 'build', 'pre-build', 'post-build' */
  phase: string[];
  /** Restrict to specific providers. If omitted, applies to all providers. */
  provider?: string[];
  /** Restrict to specific build target platforms. If omitted, applies to all platforms. */
  platform?: string[];
  /** Expression-based condition. Supports: env.VAR == 'value', env.VAR != 'value', env.VAR (truthy) */
  when?: string;
}

/**
 * A single phase (before or after) of a middleware definition.
 */
export interface MiddlewarePhase {
  /** Shell commands to execute */
  commands: string;
  /** Override image for this phase (container type only) */
  image?: string;
}

/**
 * Middleware — a composable, trigger-aware pipeline unit built on hooks.
 */
export class Middleware {
  public name!: string;
  public description?: string;
  public type!: 'command' | 'container';
  public priority: number = 100;
  public trigger!: MiddlewareTrigger;
  public image: string = 'ubuntu';
  public before?: MiddlewarePhase;
  public after?: MiddlewarePhase;
  public secrets: OrchestratorSecret[] = [];
  public allowFailure: boolean = false;
  public outputs?: string[];
}
