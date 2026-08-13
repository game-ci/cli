import { spawn } from 'node:child_process';

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
   * If any error is written to stderr, this method will throw them.
   *   new Error(stdoutErrors)
   *
   * In case of no errors, this will return an object similar to these examples
   *   { status: { success: true, code: 0 }, output: 'output from the command' }
   *   { status: { success: false, code: 1~255 }, output: 'output from the command' }
   *
   * @returns {string} output of the command on success or failure
   * @throws  {Error}  if anything was output to stderr or return code wasn't 0
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

        if (runResult.error !== '') {
          // Make sure we don't swallow any output if silent and there is an error
          const errorMessage = runResult.output && options.silent
            ? `${runResult.error}\n\n---\n\nOutput before the error:\n${runResult.output}`
            : runResult.error;

          // Throw instead of returning when any output was written to stderr
          reject(new Error(errorMessage));
          return;
        }

        // Log command output if verbose is enabled and we haven't already printed the output
        if (log.isVeryVerbose && options.silent) {
          const symbol = runResult.status.success ? '✅' : '⚠️';
          const truncatedOutput = runResult.output.length >= 30 ? `${runResult.output.slice(0, 27)}...` : runResult.output;
          log.debug('Command:', shell, commandToRun, symbol, {
            status: runResult.status,
            output: log.isMaxVerbose ? runResult.output : truncatedOutput,
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
