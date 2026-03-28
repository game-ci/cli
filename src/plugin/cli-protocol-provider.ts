import type { ProviderPlugin } from './plugin-interface.ts';

/**
 * JSON protocol types matching the orchestrator's CliProviderRequest/Response.
 */
interface CliProviderRequest {
  command: string;
  params: Record<string, any>;
}

interface CliProviderResponse {
  success: boolean;
  result?: any;
  error?: string;
  output?: string;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const RUN_TASK_TIMEOUT_MS = 7_200_000; // 2 hours
const WATCH_WORKFLOW_TIMEOUT_MS = 3_600_000; // 1 hour

/**
 * Provider that communicates with an external executable (e.g. the orchestrator
 * binary) via JSON-over-stdin/stdout protocol.
 *
 * This enables process-isolated, language-agnostic provider plugins. The external
 * executable must implement the `serve` command that reads CliProviderRequest
 * from stdin and writes CliProviderResponse to stdout.
 *
 * Protocol:
 *   stdin → { "command": "run-task", "params": { ... } }
 *   stdout ← { "success": true, "output": "...", "result": ... }
 *   stderr ← log messages (forwarded to console)
 */
export class CliProtocolProvider implements ProviderPlugin {
  private readonly executablePath: string;
  private readonly executableArgs: string[];
  private readonly buildOptions: Record<string, any>;

  /**
   * @param options Flat yargs options object. Must include:
   *   - providerExecutable: path to the external binary
   *   - providerArgs: (optional) additional arguments for the binary
   *   - All other options are forwarded as buildParameters in requests
   */
  constructor(options: Record<string, any>) {
    const executable = options.providerExecutable || options.cliExecutable;
    if (!executable || typeof executable !== 'string') {
      throw new Error(
        'CliProtocolProvider requires --provider-executable (path to orchestrator binary). ' +
        'Example: game-ci remote build --providerStrategy cli-protocol --provider-executable ./game-ci-orchestrator',
      );
    }

    this.executablePath = executable;
    this.executableArgs = ['serve'];

    // Forward provider strategy to the executable if specified
    if (options.providerBackend) {
      this.executableArgs.push('--provider-strategy', options.providerBackend);
    }

    // Store all options for forwarding as build parameters
    const { providerExecutable, cliExecutable, providerArgs, ...rest } = options;
    this.buildOptions = rest;
  }

  async setupWorkflow(
    buildGuid: string,
    buildParameters: any,
    branchName: string,
    defaultSecretsArray: any[],
  ): Promise<any> {
    const response = await this.execute('setup-workflow', {
      buildGuid,
      buildParameters: buildParameters || this.buildOptions,
      branchName,
      defaultSecretsArray,
    });
    return response.result;
  }

  async cleanupWorkflow(
    buildParameters: any,
    branchName: string,
    defaultSecretsArray: any[],
  ): Promise<any> {
    const response = await this.execute('cleanup-workflow', {
      buildParameters: buildParameters || this.buildOptions,
      branchName,
      defaultSecretsArray,
    });
    return response.result;
  }

  async runTaskInWorkflow(
    buildGuid: string,
    image: string,
    commands: string,
    mountdir: string,
    workingdir: string,
    environment: any[],
    secrets: any[],
  ): Promise<string> {
    const response = await this.executeStreaming('run-task', {
      buildGuid,
      image,
      commands,
      mountdir,
      workingdir,
      environment,
      secrets,
    }, RUN_TASK_TIMEOUT_MS);
    return response.output || '';
  }

  async garbageCollect(
    filter: string,
    previewOnly: boolean,
    olderThan: number,
    fullCache: boolean,
    baseDependencies: boolean,
  ): Promise<string> {
    const response = await this.execute('garbage-collect', {
      filter,
      previewOnly,
      olderThan,
      fullCache,
      baseDependencies,
    });
    return response.output || '';
  }

  async listResources(): Promise<any[]> {
    const response = await this.execute('list-resources', {});
    return (response.result as any[]) || [];
  }

  async listWorkflow(): Promise<any[]> {
    const response = await this.execute('list-workflow', {});
    return (response.result as any[]) || [];
  }

  async watchWorkflow(): Promise<string> {
    const response = await this.executeStreaming('watch-workflow', {}, WATCH_WORKFLOW_TIMEOUT_MS);
    return response.output || '';
  }

  /**
   * Execute a command by spawning the executable and communicating via JSON protocol.
   * Collects all stdout at once (for non-streaming commands).
   */
  private execute(
    command: string,
    params: Record<string, any>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<CliProviderResponse> {
    const request: CliProviderRequest = { command, params };

    return new Promise<CliProviderResponse>((resolve, reject) => {
      const proc = Bun.spawn([this.executablePath, ...this.executableArgs], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
        reject(new Error(`CliProtocolProvider: command '${command}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Write request to stdin
      const writer = proc.stdin.getWriter();
      writer.write(new TextEncoder().encode(JSON.stringify(request)));
      writer.close();

      // Read stdout and stderr
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]).then(([stdout, stderr, exitCode]) => {
        clearTimeout(timer);
        if (timedOut) return;

        // Log stderr
        if (stderr.trim()) {
          for (const line of stderr.trim().split('\n')) {
            log?.info?.(`[cli-protocol] ${line}`);
          }
        }

        // Find the last JSON response line in stdout
        const lines = stdout.split('\n').filter((l: string) => l.trim());
        let response: CliProviderResponse | undefined;

        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i].trim());
            if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
              response = parsed as CliProviderResponse;
              break;
            }
          } catch {
            // Not valid JSON
          }
        }

        if (response) {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(`CliProtocolProvider ${command} failed: ${response.error || 'Unknown error'}`));
          }
        } else if (exitCode === 0) {
          resolve({ success: true, output: stdout.trim() });
        } else {
          reject(new Error(
            `CliProtocolProvider ${command} exited with code ${exitCode}` +
            (stderr ? `: ${stderr.trim()}` : ''),
          ));
        }
      }).catch((error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`CliProtocolProvider: failed to spawn '${this.executablePath}': ${error.message}`));
        }
      });
    });
  }

  /**
   * Execute a streaming command — reads stdout line by line, forwarding non-JSON
   * lines as real-time build output, and captures the final JSON response.
   */
  private executeStreaming(
    command: string,
    params: Record<string, any>,
    timeoutMs: number,
  ): Promise<CliProviderResponse> {
    const request: CliProviderRequest = { command, params };

    return new Promise<CliProviderResponse>((resolve, reject) => {
      const proc = Bun.spawn([this.executablePath, ...this.executableArgs], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
        reject(new Error(`CliProtocolProvider: command '${command}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Write request to stdin
      const writer = proc.stdin.getWriter();
      writer.write(new TextEncoder().encode(JSON.stringify(request)));
      writer.close();

      const outputLines: string[] = [];
      let lastJsonResponse: CliProviderResponse | undefined;

      // Stream stdout
      const stdoutReader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let stdoutBuffer = '';

      function readStdout(): Promise<void> {
        return stdoutReader.read().then(({ done, value }) => {
          if (done) return;

          stdoutBuffer += decoder.decode(value, { stream: true });
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);
              if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
                lastJsonResponse = parsed as CliProviderResponse;
                continue;
              }
            } catch {
              // Not JSON — forward as build output
            }

            log?.info?.(trimmed);
            outputLines.push(trimmed);
          }

          return readStdout();
        });
      }

      // Stream stderr
      const stderrPromise = new Response(proc.stderr).text();

      Promise.all([readStdout(), stderrPromise, proc.exited]).then(([, stderr, exitCode]) => {
        clearTimeout(timer);
        if (timedOut) return;

        // Process any remaining stdout buffer
        if (stdoutBuffer.trim()) {
          const trimmed = stdoutBuffer.trim();
          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
              lastJsonResponse = parsed as CliProviderResponse;
            } else {
              outputLines.push(trimmed);
            }
          } catch {
            outputLines.push(trimmed);
          }
        }

        if (stderr.trim()) {
          for (const line of stderr.trim().split('\n')) {
            log?.info?.(`[cli-protocol] ${line}`);
          }
        }

        if (lastJsonResponse) {
          if (lastJsonResponse.success) {
            resolve({
              ...lastJsonResponse,
              output: lastJsonResponse.output || outputLines.join('\n'),
            });
          } else {
            reject(new Error(`CliProtocolProvider ${command} failed: ${lastJsonResponse.error || 'Unknown error'}`));
          }
        } else if (exitCode === 0) {
          resolve({ success: true, output: outputLines.join('\n') });
        } else {
          reject(new Error(
            `CliProtocolProvider ${command} exited with code ${exitCode}` +
            (stderr ? `: ${stderr.trim()}` : ''),
          ));
        }
      }).catch((error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`CliProtocolProvider: failed to spawn '${this.executablePath}': ${error.message}`));
        }
      });
    });
  }
}
