import type { CommandModule } from 'yargs';
import { BuildParameters, ImageTag, Orchestrator } from '../../model';
import { CliArguments, mapCliArgumentsToInput } from '../input-mapper';

/**
 * Runs inside the async workflow's container (AsyncWorkflow), which the host
 * starts and then leaves to run the build on its own.
 *
 * Unlike the other remote-cli commands it starts a build rather than
 * continuing one: the container's own task already runs under the host's
 * BUILD_GUID, so the build it starts takes a new guid. ASYNC_WORKFLOW keeps
 * that build from starting yet another async container.
 */
const remoteCliAsyncWorkflowCommand: CommandModule<object, CliArguments> = {
  command: 'remote-cli-async-workflow',
  describe:
    'Runs an orchestrator build from the async workflow container (internal - runs inside the remote build container)',
  handler: async (cliArguments) => {
    mapCliArgumentsToInput(cliArguments);

    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);

    await Orchestrator.run(buildParameters, baseImage.toString());
  },
};

export default remoteCliAsyncWorkflowCommand;
