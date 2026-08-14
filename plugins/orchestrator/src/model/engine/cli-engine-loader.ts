import { spawnSync } from 'child_process';
import { EnginePlugin } from './engine-plugin';
import OrchestratorLogger from '../orchestrator/services/core/orchestrator-logger';

/**
 * Load an EnginePlugin from an external CLI executable.
 *
 * Protocol: the executable receives `{"command":"get-engine-config"}` on stdin
 * and must print a JSON response on stdout:
 *
 *   { "name": "godot", "cacheFolders": [".godot/imported"], "preStopCommand": "..." }
 *
 * The executable can be any language (Go, Python, Rust, shell, etc.).
 */
export function loadEngineFromCli(executablePath: string): EnginePlugin {
  const request = JSON.stringify({ command: 'get-engine-config' });

  const result = spawnSync(executablePath, ['get-engine-config'], {
    input: request,
    encoding: 'utf-8',
    timeout: 30_000,
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw new Error(
      `Failed to spawn engine plugin executable '${executablePath}': ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || '';
    throw new Error(
      `Engine plugin executable '${executablePath}' exited with code ${result.status}${stderr ? ': ' + stderr : ''}`,
    );
  }

  const stdout = result.stdout?.trim() || '';

  // Find the last JSON object in stdout (skip any non-JSON preamble)
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
      `Engine plugin executable '${executablePath}' did not return valid JSON config. Output: ${stdout}`,
    );
  }

  if (!config.name || !Array.isArray(config.cacheFolders)) {
    throw new Error(
      `Engine plugin config from '${executablePath}' missing required fields (name, cacheFolders). Got: ${JSON.stringify(config)}`,
    );
  }

  OrchestratorLogger.log(`Loaded engine plugin '${config.name}' from CLI: ${executablePath}`);

  return {
    name: config.name,
    cacheFolders: config.cacheFolders,
    preStopCommand: config.preStopCommand || undefined,
  };
}
