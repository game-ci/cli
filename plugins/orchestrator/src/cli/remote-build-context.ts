import { BuildParameters, Orchestrator } from '../model';
import { Cli } from '../model/cli/cli';
import { mapCliArgumentsToInput, CliArguments } from './input-mapper';
import { restoreHostBuildParameters } from './host-build-parameters';

/**
 * Sets up a remote-cli command to continue the host's build inside the remote
 * build container. The host serialises the build into the container's
 * environment (TaskParameterSerializer), and the container restores every
 * parameter from there: the branch and commit to build, the host's BUILD_GUID
 * (so it works in the host's job folder and caches), and the retained
 * workspace the host locked for this build.
 */
export async function prepareRemoteBuild(cliArguments: CliArguments): Promise<void> {
  mapCliArgumentsToInput(cliArguments);
  Cli.options!.versioning = 'None';

  const buildParameters = await BuildParameters.create();
  restoreHostBuildParameters(buildParameters);

  await Orchestrator.setup(buildParameters);
}
