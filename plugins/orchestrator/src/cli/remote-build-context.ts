import { BuildParameters, Orchestrator } from '../model';
import { Cli } from '../model/cli/cli';
import { mapCliArgumentsToInput, CliArguments } from './input-mapper';

/**
 * Sets up a remote-cli command to continue the host's build inside the remote
 * build container. The host serialises the build into the container's
 * environment (TaskParameterSerializer); Input reads it from there.
 *
 * buildGuid is taken from BUILD_GUID rather than generated, so the container
 * works in the host's job folder and caches, and LOCKED_WORKSPACE carries the
 * retained workspace the host locked for this build.
 */
export async function prepareRemoteBuild(cliArguments: CliArguments): Promise<void> {
  mapCliArgumentsToInput(cliArguments);
  Cli.options!.versioning = 'None';

  const buildParameters = await BuildParameters.create();
  buildParameters.buildGuid = process.env.BUILD_GUID || buildParameters.buildGuid;
  buildParameters.lockedWorkspace = process.env.LOCKED_WORKSPACE || ``;

  await Orchestrator.setup(buildParameters);
}
