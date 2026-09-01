import type { YargsInstance } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';
import * as os from 'node:os';

function defaultDockerMemoryLimit(): string {
  const bytesInMegabyte = 1024 * 1024;

  let memoryMultiplier: number;
  switch (os.platform()) {
    case 'linux':
      memoryMultiplier = 0.95;
      break;
    case 'win32':
      memoryMultiplier = 0.8;
      break;
    default:
      memoryMultiplier = 0.75;
      break;
  }

  return `${Math.floor((os.totalmem() / bytesInMegabyte) * memoryMultiplier)}m`;
}

/**
 * Options for `game-ci test`'s classic Docker/Hub-image-driven test flow -
 * the same batchmode `-runTests` invocation unity-test-runner's action uses,
 * as an alternative to the `unityCliArgs` passthrough to Unity's own
 * experimental `unity test` CLI (see UnityTestOptions). Duplicates a handful
 * of docker/runtime flags from BuildOptions rather than sharing that module
 * directly - BuildOptions.configure() demands `targetPlatform`, which tests
 * don't need.
 */
export class DockerTestOptions implements IOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .option('docker', {
        description: String.dedent`
          Run the classic Docker/Hub-image-driven Unity batchmode test flow
          instead of Unity's own experimental \`unity test\` CLI. Requires a
          Unity Editor Docker image (see customImage/containerRegistry*).`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('local', {
        description: String.dedent`
          Only meaningful with --docker. Run the same batchmode test flow
          directly on this machine instead of inside a container - for
          self-hosted runners with Unity already installed and licensed.
          Mirrors the orchestrator's own local (host) provider.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('testPlatforms', {
        description: String.dedent`
          Semicolon-separated test platforms to run, e.g. "playmode;editmode".
          Use "COMBINE_RESULTS" as an extra entry to merge prior platforms'
          results into one summary, and "standalone" to build and run tests
          in a standalone player instead of in-editor.`,
        type: 'string',
        demandOption: false,
        default: 'playmode;editmode',
      })
      .option('artifactsPath', {
        description: 'Path (relative to the project) to write test result XML and logs to.',
        type: 'string',
        demandOption: false,
        default: 'artifacts',
      })
      .option('coverageEnabled', {
        description: String.dedent`
          Enable Unity's code coverage instrumentation during the test run.
          Some Unity versions/configurations fail or crash with this on -
          see game-ci/unity-test-runner#302, #306, #301. Set to false to
          omit -enableCodeCoverage/-coverageOptions/-coverageResultsPath
          entirely.`,
        type: 'boolean',
        demandOption: false,
        default: true,
      })
      .option('coverageResultsPath', {
        description: 'Path (relative to the project) to write code coverage results to.',
        type: 'string',
        demandOption: false,
        default: 'CodeCoverage',
      })
      .option('coverageOptions', {
        description: "Additional arguments to pass to Unity's code coverage package.",
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('packageMode', {
        description: String.dedent`
          Test a Unity package (projectPath points at the package folder,
          not a full project) by creating a throwaway project and adding
          the package as a local file dependency.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('packageName', {
        description: 'Package name to add to the throwaway project. Required when packageMode is set.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('scopedRegistryUrl', {
        description: 'Scoped registry URL to add to the throwaway project when in packageMode.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('registryScopes', {
        description: 'Comma-separated scopes for scopedRegistryUrl.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('privateRegistryToken', {
        description: 'Auth token for a private UPM registry, written to .upmconfig.toml before testing.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('privateRegistryUser', {
        description: 'Username for a private UPM registry that requires one even with token auth (e.g. Azure DevOps).',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('runAsHostUser', {
        description: String.dedent`Linux only. Run as a user matching the host system's UID/GID instead of the
        container's default root user, so artifacts aren't left root-owned on the host.`,
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('useHostNetwork', {
        description: 'Linux only. Initialises Docker using the host network.',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('dockerCpuLimit', {
        description: 'Number of CPU cores to assign the docker container. Defaults to all available cores.',
        type: 'string',
        demandOption: false,
        default: os.cpus().length.toString(),
      })
      .option('dockerMemoryLimit', {
        description: String.dedent`Amount of memory to assign the docker container. Defaults to 95% of total system
        memory rounded down to the nearest megabyte on Linux and 80% on Windows.`,
        type: 'string',
        demandOption: false,
        default: defaultDockerMemoryLimit(),
      })
      .option('dockerShmSize', {
        description: String.dedent`Size of /dev/shm to assign the docker container, using the format <number><unit>
        (m or g). Unity 6.6+ editors request 1GiB of shared memory and fail with "Insufficient shared memory
        available" against Docker's 64m default - see game-ci/unity-test-runner#307/#308. Defaults to 1025m;
        pass "0" to omit the flag and use Docker's own default.`,
        type: 'string',
        demandOption: false,
        default: '1025m',
      })
      .option('dockerIsolationMode', {
        description: 'Windows only. Isolation mode for the docker container: process, hyperv, or default.',
        type: 'string',
        demandOption: false,
        default: 'default',
      })
      .option('containerRegistryRepository', {
        description: 'Container registry and repository to pull the Unity editor image from. Only applies if customImage is not set.',
        type: 'string',
        demandOption: false,
        default: 'unityci/editor',
      })
      .option('containerRegistryImageVersion', {
        description: 'Container registry image rolling version. Only applies if customImage is not set.',
        type: 'string',
        demandOption: false,
        default: '3',
      })
      .option('sshPublicKeysDirectoryPath', {
        description: 'Path to a directory containing SSH public keys to forward to the container.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('dockerWorkspacePath', {
        description: 'The path to mount the workspace inside the docker container.',
        type: 'string',
        demandOption: false,
        default: '/github/workspace',
      });
  }
}
