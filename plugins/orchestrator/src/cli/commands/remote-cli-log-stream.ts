import type { CommandModule } from 'yargs';
import { RemoteClient } from '../../model/orchestrator/remote-client';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';

interface RemoteCliLogStreamArguments extends CliArguments {
  logFile: string;
}

/**
 * Runs inside the remote build container - reads the piped build/setup
 * output from stdin and writes it to a log file (and, for K8s, echoes it to
 * stdout so `kubectl logs` captures it too). See remote-cli-pre-build.ts's
 * doc comment for why this needs to be a real yargs command.
 *
 * RemoteClient.remoteClientLogStream reads Cli.options['logFile'] directly
 * rather than taking it as a parameter, so mapCliArgumentsToInput has to run
 * first to populate that.
 *
 * Deliberately does not await stream completion: attaching the stdin
 * listeners is enough to keep the process alive until the pipe closes, the
 * same way the process stayed alive under the old dispatch protocol.
 */
const remoteCliLogStreamCommand: CommandModule<object, RemoteCliLogStreamArguments> = {
  command: 'remote-cli-log-stream',
  describe:
    'Streams piped build output to a log file (internal - runs inside the remote build container)',
  builder: (yargs) => {
    return yargs.option('log-file', {
      alias: 'logFile',
      type: 'string',
      description: 'Path to write the streamed log output to',
      demandOption: true,
    }) as any;
  },
  handler: async (cliArguments) => {
    mapCliArgumentsToInput(cliArguments);
    await RemoteClient.remoteClientLogStream();
  },
};

export default remoteCliLogStreamCommand;
