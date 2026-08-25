import type { CommandModule } from 'yargs';
import { BuildParameters, Orchestrator } from '../../model';
import { RemoteClient } from '../../model/orchestrator/remote-client';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';

/**
 * Runs inside the remote build container (AWS/K8s), after the build -
 * pushes the Library/Build caches. See remote-cli-pre-build.ts's doc
 * comment for why this needs to be a real yargs command: the `-m` protocol
 * it used to be dispatched through no longer has a live dispatcher.
 */
const remoteCliPostBuildCommand: CommandModule<object, CliArguments> = {
  command: 'remote-cli-post-build',
  describe: 'Runs post-build cache push tasks (internal - runs inside the remote build container)',
  handler: async (cliArguments) => {
    mapCliArgumentsToInput(cliArguments);
    Orchestrator.buildParameters = await BuildParameters.create();
    await RemoteClient.remoteClientPostBuild();
  },
};

export default remoteCliPostBuildCommand;
