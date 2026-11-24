import type { CommandModule } from 'yargs';
import remoteCliPreBuildCommand from '../cli/commands/remote-cli-pre-build';
import remoteCliPostBuildCommand from '../cli/commands/remote-cli-post-build';
import remoteCliLogStreamCommand from '../cli/commands/remote-cli-log-stream';
import remoteCliAsyncWorkflowCommand from '../cli/commands/remote-cli-async-workflow';

/**
 * The remote-cli commands, as game-ci CLI commands.
 *
 * Remote build containers clone game-ci/cli and run its dist/index.js (see
 * BuildAutomationWorkflow and AsyncWorkflow), which is the game-ci CLI, not this package's own
 * src/cli.ts. These commands therefore have to reach the game-ci CLI through
 * this plugin, or every remote build fails at `remote-cli-pre-build` with
 * "Unknown argument".
 */
const remoteCliCommands: Record<string, CommandModule<object, any>> = {
  'remote-cli-pre-build': remoteCliPreBuildCommand,
  'remote-cli-post-build': remoteCliPostBuildCommand,
  'remote-cli-log-stream': remoteCliLogStreamCommand,
  'remote-cli-async-workflow': remoteCliAsyncWorkflowCommand,
};

export const remoteCliCommandNames = Object.keys(remoteCliCommands);

/**
 * Each command's own options; everything else comes from the container's
 * environment. Optional to yargs like every game-ci CLI option: it parses more
 * than once, and a demanded option fails a later parse. execute() requires them.
 */
const ownOptions: Record<string, Record<string, { type: 'string'; description: string }>> = {
  'remote-cli-log-stream': {
    logFile: { type: 'string', description: 'Path to write the streamed log output to' },
  },
};

/**
 * Hands the handler only its own arguments. It reads everything else from the
 * container's environment, and the game-ci CLI's option defaults would override
 * that environment once they reached Cli.options.
 */
function ownArgumentsOf(name: string, options: Record<string, unknown>): Record<string, unknown> {
  const own: Record<string, unknown> = {};
  for (const option of Object.keys(ownOptions[name] ?? {})) {
    if (options[option] === undefined || options[option] === '') {
      throw new Error(`${name} requires --${option}`);
    }
    own[option] = options[option];
  }

  return own;
}

export function createRemoteCliCommand(name: string) {
  const command = remoteCliCommands[name];
  if (!command) return null;

  return {
    name,
    async execute(options: Record<string, unknown>): Promise<boolean> {
      await command.handler(ownArgumentsOf(name, options) as any);

      return true;
    },
    async configureOptions(yargs: any): Promise<void> {
      for (const [option, config] of Object.entries(ownOptions[name] ?? {})) {
        yargs.option(option, { ...config, demandOption: false });
      }
    },
  };
}
