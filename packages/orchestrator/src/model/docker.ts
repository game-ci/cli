/**
 * Docker runner — executes container builds via `docker run`.
 *
 * Used by the local-docker provider (and the local AWS emulator auto-fallback)
 * to run builds inside Docker containers.
 */

import * as core from '@actions/core';
import { spawn } from 'node:child_process';
import { StringKeyValuePair } from './shared-types';

class Docker {
  static async run(
    image: string,
    parameters: { [key: string]: any },
    silent = false,
    overrideCommands = '',
    additionalVariables: StringKeyValuePair[] = [],
    options?: any,
    entrypointBash = false,
  ): Promise<number> {
    const workspace = parameters.workspace || process.env.GITHUB_WORKSPACE || process.cwd();

    const args: string[] = ['run', '--rm'];

    // Volume mounts: workspace → /github/workspace and /data
    args.push('-v', `${workspace}:/github/workspace`);
    args.push('-v', `${workspace}:/data`);

    // Working directory
    args.push('-w', '/github/workspace');

    // Environment variables
    for (const envVar of additionalVariables) {
      if (envVar && envVar.name && envVar.value !== undefined) {
        args.push('-e', `${envVar.name}=${envVar.value}`);
      }
    }

    // Override entrypoint to shell when entrypointBash is set
    if (overrideCommands && entrypointBash) {
      args.push('--entrypoint', '/bin/sh');
    }

    // Image
    args.push(image);

    // Override commands
    if (overrideCommands) {
      if (entrypointBash) {
        args.push('-c', overrideCommands);
      } else {
        args.push(overrideCommands);
      }
    }

    if (!silent) {
      core.info(`[Docker] run: image=${image}, overrideCommands=${overrideCommands}`);
    }

    return new Promise<number>((resolve, reject) => {
      const child = spawn('docker', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (data: Buffer) => {
        if (!silent) {
          process.stdout.write(data);
        }
        if (options?.listeners?.stdout) {
          options.listeners.stdout(data);
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        if (!silent) {
          process.stderr.write(data);
        }
        if (options?.listeners?.stderr) {
          options.listeners.stderr(data);
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Docker process failed to start: ${error.message}`));
      });

      child.on('close', (code) => {
        resolve(code ?? 1);
      });
    });
  }
}

export default Docker;
export { Docker };
