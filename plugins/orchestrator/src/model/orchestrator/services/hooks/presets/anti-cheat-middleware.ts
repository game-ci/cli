import { Middleware } from '../middleware';
import OrchestratorSecret from '../../../options/orchestrator-secret';

/**
 * Anti-cheat / build-integrity middleware presets.
 *
 * Anti-cheat integration is not a command anyone runs on its own - it is a
 * step that has to happen to an existing build, after the player is
 * produced and before it is shipped. That is precisely what
 * middleware-service already models (trigger-aware before/after phases), so
 * this is a preset over Middleware rather than a separate plugin.
 *
 * Both supported SDKs are gated behind vendor NDAs and are not publicly
 * downloadable, so this module deliberately does not embed a fixed
 * command line for either. The caller supplies the command; what the preset
 * owns is the *wiring* that is easy to get wrong: running at post-build
 * rather than build, never allowing a silent failure, and passing
 * credentials as secrets instead of interpolating them into a shell string.
 */

export type AntiCheatProvider = 'easy-anti-cheat' | 'battleye';

export interface AntiCheatMiddlewareConfig {
  provider: AntiCheatProvider;
  /**
   * Command that runs the vendor's signing/integrity tool against the
   * built player. Supplied by the caller because the tooling is
   * NDA-gated and its invocation differs per licensee.
   */
  command: string;
  /** Secret names the command needs (API keys, signing credentials). */
  secretNames?: string[];
  /** Restrict to specific target platforms. Defaults to all. */
  platforms?: string[];
  /** Container image providing the vendor tooling, if containerized. */
  image?: string;
}

/**
 * Builds the middleware definition for an anti-cheat integration step.
 *
 * `allowFailure` is forced to false and not configurable. A build that
 * silently skipped its integrity step but still produced a shippable
 * player is the worst possible outcome here - it looks successful and
 * ships unprotected. Failing loudly is the only safe default, and making
 * it opt-outable would invite exactly the misconfiguration this preset
 * exists to prevent.
 */
export function createAntiCheatMiddleware(config: AntiCheatMiddlewareConfig): Middleware {
  if (!config.command.trim()) {
    throw new Error(
      `Anti-cheat middleware for ${config.provider} requires a command - the vendor SDKs are ` +
        'NDA-gated, so no default invocation can be assumed.',
    );
  }

  const middleware = new Middleware();
  middleware.name = `anti-cheat-${config.provider}`;
  middleware.description = `Applies ${config.provider} build integrity to the built player`;
  middleware.type = config.image ? 'container' : 'command';
  if (config.image) middleware.image = config.image;

  // Runs after the player exists; a pre-build or build-phase hook would
  // have nothing to operate on.
  middleware.trigger = {
    phase: ['post-build'],
    ...(config.platforms ? { platform: config.platforms } : {}),
  };

  // Lower number = earlier. This must precede packaging/upload steps, which
  // sit at the default 100, or an unprotected binary gets shipped.
  middleware.priority = 50;

  middleware.after = { commands: config.command };
  middleware.allowFailure = false;

  middleware.secrets = (config.secretNames ?? []).map((name) => {
    const secret = new OrchestratorSecret();
    secret.ParameterKey = name;
    secret.EnvironmentVariable = name;
    secret.ParameterValue = '';

    return secret;
  });

  return middleware;
}
