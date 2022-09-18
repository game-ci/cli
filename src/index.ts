import { Cli } from './cli.ts';

class GameCI {
  public static async run() {
    try {
      // Configure
      const cli = await new Cli(Deno.args, Deno.cwd());
      await cli.setup();
      await cli.registerCommands();
      await cli.registerSchemaForChosenCommand();

      // Command
      const { command, options } = await cli.validateAndParseArguments();
      const success = await command.execute(options);

      // Result
      await GameCI.handleResult(success, command);
    } catch (error) {
      await GameCI.handleError(error);
    }
  }

  private static async handleResult(success: boolean, command: CommandInterface) {
    if (log.isQuiet) return;

    if (success) {
      log.info(`${command.name} done.`);
    } else {
      log.warning(`${command.constructor.name} failed.`);
    }
  }

  private static async handleError(error) {
    try {
      log.error(error);
    } catch (metaError) {
      // If the app fails before logger is defined, we need to log to console.
      // Console will not output colors, but it's better than nothing
      console.error('Error 1:', error);
      // We also need to indicate that the logger failed
      console.error('Error 2:', metaError);
    }

    // Ensure the process exits with a non-zero exit code
    Deno.exit(1);
  }
}

await GameCI.run();
