import type { CommandModule } from 'yargs';
import { BuildParameters, Orchestrator } from '../../model';
import { RemoteClient } from '../../model/orchestrator/remote-client';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';

/**
 * Runs inside the remote build container (AWS/K8s), before the actual
 * Unity/engine build - bootstraps the git workspace (full clone, incremental
 * sync, or retained-workspace reuse) and runs `before-build` hooks.
 *
 * This used to be dispatched via a bespoke `-m remote-cli-pre-build` flag,
 * a protocol from when this package was a standalone repo with its own
 * argv-based CliFunction dispatcher. That dispatcher does not exist in
 * either this package's own yargs-based src/cli.ts or game-ci/cli's -
 * `Unknown argument: m` in a strict-mode yargs parser is a hard failure,
 * not a warning it recovers from, so every remote build's pre-build step
 * has been broken since the CliFunction/-m protocol was retired. A real
 * yargs command is the fix.
 *
 * Reads entirely from the environment (INPUT_* vars already present in the
 * container via the images this build ran with) - the original bare
 * `-m remote-cli-pre-build` invocation took no CLI flags at all, so this
 * command intentionally accepts none either.
 */
const remoteCliPreBuildCommand: CommandModule<object, CliArguments> = {
  command: 'remote-cli-pre-build',
  describe:
    'Sets up a repository, usually before a game-ci build (internal - runs inside the remote build container)',
  handler: async (cliArguments) => {
    mapCliArgumentsToInput(cliArguments);
    Orchestrator.buildParameters = await BuildParameters.create();
    await RemoteClient.setupRemoteClient();
  },
};

export default remoteCliPreBuildCommand;
