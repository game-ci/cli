import {iterateReader} from '../../dependencies.ts';

export interface RunOptions {
  cwd?: string;
  silent?: boolean;
}

export interface RunResult {
  [key: string]: Deno.ProcessStatus | string | undefined;
  status?: Deno.ProcessStatus;
  output: string;
  error: string;
}

class System {
  /**
   * Run any command as if you're typing in shell.
   * Make sure it's Windows/MacOS/Ubuntu compatible or has alternative commands.
   * 
   * If any error is written to stderr, this method will throw them.
   *   ❌ new Error(stdoutErrors)
   *
   * In case of no errors, this will return an object similar to these examples
   *   ✔️ { status: { success: true, code: 0 }, output: 'output from the command' }
   *   ⚠️ { status: { success: false, code: 1~255 }, output: 'output from the command' }
   *
   * Example usage:
   *     System.newRun(sh, ['-c', 'echo something'])
   *     System.newRun(powershell, ['echo something'])
   * @returns {string} output of the command on success or failure
   *
   * @throws  {Error}  if anything was output to stderr or return code wasn't 0
   */
  static async run(command: string, windowsSpecificCommand?: string, options: RunOptions = {silent: false}): Promise<RunResult> {
    let commandArray: string[];
    let commandToRun = command;
    switch(Deno.build.os) {
      case 'windows':
        if (log.isVeryVerbose) log.debug(`The following command is run using powershell`);
        if (windowsSpecificCommand) {
          commandToRun = windowsSpecificCommand;
        }
        commandArray = ['powershell', commandToRun];
        break;
      default:
        if (log.isVeryVerbose) log.debug(`The following command is run using sh`);
        commandArray = ['sh -c', commandToRun];
        break;
    }

    const runCommand: Deno.RunOptions = { 
      cmd: commandArray,
      stdout: "piped", 
      stderr: "piped" 
    };

    if (options.cwd) runCommand.cwd = options.cwd;

    const process = Deno.run(runCommand);

    const stdoutIterator = iterateReader(process.stdout!);
    const stderrIterator = iterateReader(process.stderr!);

    const runResult: RunResult = { output: "", error: "" };

    // This will pipe the output to stdout/stderr and store it in runResult simultaneously
    const processOutput = async (iterator: AsyncIterable<Uint8Array>, outputStream: typeof Deno.stdout | typeof Deno.stderr, bufferName: string) => {
      for await (const chunk of iterator) {
        const text = new TextDecoder().decode(chunk);
        runResult[bufferName] += text;

        if (!options.silent) {
          outputStream.write(chunk);
        }
      }
    };

    const [status] = await Promise.all([
      process.status(),
      processOutput(stdoutIterator, Deno.stdout, "output"),
      processOutput(stderrIterator, Deno.stderr, "error")
    ]);

    runResult.status = status;

    if (runResult.error !== '') {
      // Make sure we don't swallow any output if silent and there is an error
      const errorMessage = runResult.output && options.silent ? 
        `${runResult.error}\n\n---\n\nOutput before the error:\n${runResult.output}` : 
        runResult.error;

      // Throw instead of returning when any output was written to stderr
      throw new Error(errorMessage);
    }

    // Log command output if verbose is enabled and we haven't already printed the output
    if (log.isVeryVerbose && options.silent) {
      const symbol = status.success ? '✅' : '⚠️';
      const truncatedOutput = runResult.output.length >= 30 ? `${runResult.output.slice(0, 27)}...` : runResult.output;
      log.debug('Command:', commandArray[0], commandToRun, symbol, {
        status,
        output: log.isMaxVerbose ? runResult.output : truncatedOutput,
      });
    }
    
    return runResult;
  }
}

export default System;
