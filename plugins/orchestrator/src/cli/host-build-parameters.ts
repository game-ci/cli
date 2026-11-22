import { BuildParameters } from '../model';
import { TaskParameterSerializer } from '../model/orchestrator/services/core/task-parameter-serializer';
import OrchestratorLogger from '../model/orchestrator/services/core/orchestrator-logger';
import { mapCliOptionsToBuildParameters } from '../cli-plugin/build-parameters-adapter';

/** A remote build always runs this CLI, whatever mode the host ran in. */
const containerOwnParameters = new Set(['isCliMode']);

/**
 * Restores the host's build parameters from the remote build container's
 * environment, the inverse of TaskParameterSerializer: the host sends each
 * field as its SCREAMING_SNAKE_CASE name and its value as a string.
 *
 * The CLI option mapping supplies every field with a typed default, so each
 * value is read back as the type the host sent. Lists and objects are sent
 * flattened, so they keep the container's value, as do fields named in `kept`.
 */
export function restoreHostBuildParameters(
  buildParameters: BuildParameters,
  kept: ReadonlyArray<string> = [],
): void {
  const typedDefaults = mapCliOptionsToBuildParameters({}) as unknown as Record<string, unknown>;
  const container = buildParameters as unknown as Record<string, unknown>;
  const restored: string[] = [];

  for (const [key, typedDefault] of Object.entries(typedDefaults)) {
    const name = TaskParameterSerializer.ToEnvVarFormat(key);
    const sent = process.env[name];
    if (
      sent === undefined ||
      typeof typedDefault === 'object' ||
      kept.includes(key) ||
      containerOwnParameters.has(key)
    ) {
      continue;
    }

    const value = valueAsSent(sent, typedDefault);
    if (value === undefined) {
      OrchestratorLogger.logWarning(`Ignoring ${name}: expected a number, got "${sent}"`);
      continue;
    }

    container[key] = value;
    restored.push(key);
  }

  OrchestratorLogger.log(`Restored ${restored.length} build parameters from the host`);
}

function valueAsSent(sent: string, typedDefault: unknown): unknown {
  if (typeof typedDefault === 'boolean') return sent === 'true';
  if (typeof typedDefault === 'number') {
    const number = Number(sent);

    return Number.isNaN(number) ? undefined : number;
  }

  return sent;
}
