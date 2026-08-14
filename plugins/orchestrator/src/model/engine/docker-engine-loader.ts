import { spawnSync } from 'child_process';
import { EnginePlugin } from './engine-plugin';
import OrchestratorLogger from '../orchestrator/services/core/orchestrator-logger';

/**
 * Load an EnginePlugin from a Docker image.
 *
 * The container is run with `docker run --rm <image> get-engine-config`
 * and must print a JSON config on stdout:
 *
 *   { "name": "godot", "cacheFolders": [".godot/imported"], "preStopCommand": "..." }
 *
 * This allows community engine plugins to be distributed as Docker images.
 */
export function loadEngineFromDocker(image: string): EnginePlugin {
  const result = spawnSync('docker', ['run', '--rm', image, 'get-engine-config'], {
    encoding: 'utf-8',
    timeout: 120_000,
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw new Error(`Failed to run engine plugin Docker image '${image}': ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || '';
    throw new Error(
      `Engine plugin Docker image '${image}' exited with code ${result.status}${stderr ? ': ' + stderr : ''}`,
    );
  }

  const stdout = result.stdout?.trim() || '';

  // Find the last JSON object in stdout
  const lines = stdout.split('\n');
  let config: any;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i].trim());
      if (typeof parsed === 'object' && parsed !== null && parsed.name) {
        config = parsed;
        break;
      }
    } catch {
      // Not JSON, skip
    }
  }

  if (!config) {
    throw new Error(
      `Engine plugin Docker image '${image}' did not return valid JSON config. Output: ${stdout}`,
    );
  }

  if (!config.name || !Array.isArray(config.cacheFolders)) {
    throw new Error(
      `Engine plugin config from Docker image '${image}' missing required fields (name, cacheFolders). Got: ${JSON.stringify(config)}`,
    );
  }

  OrchestratorLogger.log(`Loaded engine plugin '${config.name}' from Docker: ${image}`);

  return {
    name: config.name,
    cacheFolders: config.cacheFolders,
    preStopCommand: config.preStopCommand || undefined,
  };
}
