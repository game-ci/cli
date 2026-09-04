import { spawn } from 'node:child_process';
import { SecretRedaction } from '../secret-redaction.ts';

export interface RunOptions {
  cwd?: string;
  silent?: boolean;
  /** Extra env vars merged on top of the current process's env for the spawned command. */
  env?: Record<string, string | undefined>;
}

export interface RunResult {
  [key: string]: { success: boolean; code: number } | string | undefined;
  status?: { success: boolean; code: number };
  output: string;
  error: string;
}

class System {
  /**
   * Run any command as if you're typing in shell.
   * Make sure it's Windows/MacOS/Ubuntu compatible or has alternative commands.
   *
   * If the command exits with a non-zero code, this method throws (message
   * built from stderr, falling back to a generic "exited with code N").
   * A non-empty stderr alone is not treated as failure - many commands
   * (e.g. `docker run` auto-pulling an uncached image) write informational
   * output there on a genuinely successful run.
   *
   * In case of success, this will return an object similar to these examples
   *   { status: { success: true, code: 0 }, output: 'output from the command' }
   *
   * @returns {string} output of the command on success
   * @throws  {Error}  if the command's exit code wasn't 0
   */
  static async run(command: string, windowsSpecificCommand?: string, options: RunOptions = { silent: false }): Promise<RunResult> {
    let shell: string;
    let shellArgs: string[];
    let commandToRun = command;

    switch (process.platform) {
      case 'win32':
        if (log.isVeryVerbose) log.debug(`The following command is run using powershell`);
        if (windowsSpecificCommand) {
          commandToRun = windowsSpecificCommand;
        }
        shell = 'powershell';
        shellArgs = ['-Command', commandToRun];
        break;
      default:
        if (log.isVeryVerbose) log.debug(`The following command is run using sh`);
        shell = 'sh';
        shellArgs = ['-c', commandToRun];
        break;
    }

    return new Promise<RunResult>((resolve, reject) => {
      const proc = spawn(shell, shellArgs, {
        cwd: options.cwd,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: options.env ? { ...process.env, ...options.env } : process.env,
      });

      const runResult: RunResult = { output: '', error: '' };

      proc.stdout!.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        runResult.output += text;

        if (!options.silent) {
          process.stdout.write(chunk);
        }
      });

      proc.stderr!.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        runResult.error += text;

        if (!options.silent) {
          process.stderr.write(chunk);
        }
      });

      proc.on('close', (code: number | null) => {
        const exitCode = code ?? 1;
        runResult.status = { success: exitCode === 0, code: exitCode };

        if (exitCode !== 0) {
          // Real bug (game-ci/unity-activate#111): this used to throw on
          // *any* stderr output, regardless of exit code. `docker run` on
          // an image not yet cached locally writes "Unable to find image
          // '...' locally" to stderr as pure status output, then pulls it
          // and succeeds with exit code 0 - which this treated as a fatal
          // error anyway, discarding the successful run. Exit code is the
          // actual signal; stderr content is still included below for
          // debugging when the command genuinely failed.
          const errorMessage = runResult.output && options.silent
            ? `${runResult.error}\n\n---\n\nOutput before the error:\n${runResult.output}`
            : runResult.error || `Command exited with code ${exitCode}`;

          reject(new Error(errorMessage));
          return;
        }

        // Log command output if verbose is enabled and we haven't already printed the output
        if (log.isVeryVerbose && options.silent) {
          const symbol = runResult.status.success ? '✅' : '⚠️';
          const truncatedOutput = runResult.output.length >= 30 ? `${runResult.output.slice(0, 27)}...` : runResult.output;
          // Both the command and the captured output can carry secrets - the
          // command because it may be a `docker run ... --env UNITY_PASSWORD=`
          // line, the output because Unity echoes back some of what it was
          // given. See SecretRedaction.
          log.debug('Command:', shell, SecretRedaction.redact(commandToRun), symbol, {
            status: runResult.status,
            output: SecretRedaction.redact(log.isMaxVerbose ? runResult.output : truncatedOutput),
          });
        }

        resolve(runResult);
      });

      proc.on('error', (err: Error) => {
        reject(err);
      });
    });
  }
}

export { System };
