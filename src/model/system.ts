export interface RunOptions {
  pwd: string;
}

class System {
  /**
   * Run any command as if you're typing in shell.
   * Make sure it's Windows/MacOS/Ubuntu compatible or has alternative commands.
   *
   * Intended to always be silent and capture the output.
   *
   * @returns {string} output of the command on success or failure
   *
   * @throws  {Error}  if anything was output to stderr.
   */
  static async run(rawCommand: string, options: RunOptions = {}): Promise<string> {
    const { pwd } = options;

    let command = rawCommand;
    if (pwd) command = `cd ${pwd} ; ${command}`;

    const isWindows = Deno.build.os === 'windows';
    const shellMethod = isWindows ? System.powershellRun : System.shellRun;

    if (log.isVeryVerbose) log.debug(`The following command is run using ${shellMethod.name}`);

    return shellMethod(command, options);
  }

  static async shellRun(command: string, options: RunOptions = {}): Promise<string> {
    return System.newRun('sh', ['-c', command]);
  }

  static async powershellRun(command: string, options: RunOptions = {}): Promise<string> {
    return System.newRun('powershell', [command]);
  }

  /**
   * Internal cross-platform run, that spawns a new process and captures its output.
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
   *
   * @deprecated not really deprecated, but please use System.run instead because this method will be made private.
   */
  public static async newRun(command, args: string | string[] = []): Promise<string> {
    if (!Array.isArray(args)) args = [args];

    const argsString = args.join(' ');
    const process = Deno.run({
      cmd: [command, ...args],
      stdout: 'piped',
      stderr: 'piped',
    });

    const status = await process.status();
    const outputBuffer = await process.output();
    const errorBuffer = await process.stderrOutput();

    process.close();

    const output = new TextDecoder().decode(outputBuffer).replace(/[\n\r]+$/, '');
    const error = new TextDecoder().decode(errorBuffer).replace(/[\n\r]+$/, '');

    const result = { status, output };

    // Log command output if verbose is enabled
    if (log.isVeryVerbose) {
      const symbol = status.success ? '✅' : '❗';
      const truncatedOutput = output.length >= 30 ? `${output.slice(0, 27)}...` : output;
      log.debug('Command:', command, argsString, symbol, {
        status,
        output: log.isMaxVerbose ? output : truncatedOutput,
      });
    }

    if (error) {
      // Make sure we don't swallow any output
      const errorMessage = output ? `${error}\n\n---\n\nOutput before the error:\n${output}` : error;

      // Throw instead or returning when any output was written to stdout
      throw new Error(errorMessage);
    }

    return result;
  }
}

export default System;
