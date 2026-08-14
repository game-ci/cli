import type { CommandModule } from 'yargs';
import {
  CliProviderRequest,
  CliProviderResponse,
} from '../../model/orchestrator/providers/cli/cli-provider-protocol';
import { ProviderInterface } from '../../model/orchestrator/providers/provider-interface';
import { BuildParameters } from '../../model';
import { mapCliArgumentsToInput, CliArguments } from '../input-mapper';

/**
 * Read all of stdin as a string.
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

/**
 * Write a JSON response to stdout followed by a newline.
 */
function writeResponse(response: CliProviderResponse): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

/**
 * Serve command — JSON protocol server mode.
 *
 * Reads a CliProviderRequest from stdin, dispatches to the appropriate provider,
 * and writes a CliProviderResponse to stdout. This allows the orchestrator binary
 * to act as an executable plugin for the @game-ci/cli.
 *
 * Protocol:
 *   stdin:  { "command": "<subcommand>", "params": { ... } }
 *   stdout: { "success": true, "result": ..., "output": "..." }
 *           or { "success": false, "error": "..." }
 *
 * The provider is selected based on --provider-strategy (default: "aws").
 * Build parameters are constructed from CLI flags, just like the `orchestrate` command.
 */

interface ServeArguments extends CliArguments {
  providerStrategy?: string;
}

const serveCommand: CommandModule<object, ServeArguments> = {
  command: 'serve',
  describe: 'JSON protocol server mode — reads requests from stdin and writes responses to stdout',
  builder: (yargs) => {
    return yargs
      .option('provider-strategy', {
        alias: 'providerStrategy',
        type: 'string',
        description: 'Orchestrator provider: aws, k8s, local-docker, local-system, test, etc.',
        default: 'aws',
      })
      .option('target-platform', {
        alias: 'targetPlatform',
        type: 'string',
        description: 'Platform that the build should target',
        default: 'StandaloneLinux64',
      })
      .option('unity-version', {
        alias: 'unityVersion',
        type: 'string',
        description: 'Version of Unity to use',
        default: 'auto',
      })
      .option('project-path', {
        alias: 'projectPath',
        type: 'string',
        description: 'Path to the project to be built',
        default: '.',
      })
      .option('engine', {
        type: 'string',
        description: 'Game engine name (unity, godot, unreal, etc.)',
        default: 'unity',
      })
      .option('container-cpu', {
        alias: 'containerCpu',
        type: 'string',
        description: 'CPU allocation for remote build container',
        default: '1024',
      })
      .option('container-memory', {
        alias: 'containerMemory',
        type: 'string',
        description: 'Memory allocation for remote build container',
        default: '3072',
      })
      .option('aws-stack-name', {
        alias: 'awsStackName',
        type: 'string',
        description: 'The Cloud Formation stack name (AWS provider)',
        default: 'game-ci',
      })
      .option('kube-config', {
        alias: 'kubeConfig',
        type: 'string',
        description: 'Base64 encoded Kubernetes config (K8s provider)',
        default: '',
      })
      .option('dry-run', {
        alias: 'dryRun',
        type: 'boolean',
        description: 'Preview garbage-collect actions without deleting resources',
        default: false,
      })
      .example(
        'echo \'{"command":"list-resources","params":{}}\' | game-ci serve --provider-strategy aws',
        'List AWS resources',
      )
      .example(
        'echo \'{"command":"run-task","params":{...}}\' | game-ci serve --provider-strategy k8s',
        'Run a build task on Kubernetes',
      ) as any;
  },
  handler: async (cliArguments) => {
    try {
      // Read the JSON request from stdin
      const rawInput = await readStdin();
      if (!rawInput.trim()) {
        writeResponse({
          success: false,
          error: 'No input received on stdin. Expected a JSON request.',
        });
        process.exit(1);
        return;
      }

      let request: CliProviderRequest;
      try {
        request = JSON.parse(rawInput.trim());
      } catch {
        writeResponse({
          success: false,
          error: `Invalid JSON on stdin: ${rawInput.substring(0, 200)}`,
        });
        process.exit(1);
        return;
      }

      if (!request.command) {
        writeResponse({ success: false, error: 'Missing "command" field in request' });
        process.exit(1);
        return;
      }

      // Merge request params into CLI arguments for BuildParameters
      // Request params can override CLI flags (e.g., buildParameters from the caller)
      const mergedArgs = { ...cliArguments };
      if (request.params?.buildParameters) {
        Object.assign(mergedArgs, request.params.buildParameters);
      }

      mapCliArgumentsToInput(mergedArgs);

      const providerStrategy = mergedArgs.providerStrategy || 'aws';
      process.stderr.write(`[serve] Provider: ${providerStrategy}, Command: ${request.command}\n`);

      // Load the provider — use direct imports for built-in providers
      const buildParameters = await BuildParameters.create();
      const provider = await loadBuiltinProvider(providerStrategy, buildParameters);

      // Dispatch the command
      const response = await dispatchCommand(provider, request, mergedArgs);
      writeResponse(response);

      // Logging already goes to stderr via core shim
    } catch (error: any) {
      writeResponse({ success: false, error: error.message || String(error) });
      process.exit(1);
    }
  },
};

async function dispatchCommand(
  provider: any,
  request: CliProviderRequest,
  cliArgs: Record<string, any> = {},
): Promise<CliProviderResponse> {
  const { command, params } = request;

  switch (command) {
    case 'setup-workflow': {
      const result = await provider.setupWorkflow(
        params.buildGuid || '',
        params.buildParameters || {},
        params.branchName || '',
        params.defaultSecretsArray || [],
      );
      return { success: true, result };
    }

    case 'cleanup-workflow': {
      const result = await provider.cleanupWorkflow(
        params.buildParameters || {},
        params.branchName || '',
        params.defaultSecretsArray || [],
      );
      return { success: true, result };
    }

    case 'run-task': {
      const output = await provider.runTaskInWorkflow(
        params.buildGuid || '',
        params.image || '',
        params.commands || '',
        params.mountdir || '',
        params.workingdir || '',
        params.environment || [],
        params.secrets || [],
      );
      return { success: true, output };
    }

    case 'garbage-collect': {
      const previewOnly = params.previewOnly ?? cliArgs.dryRun ?? false;
      const olderThan = params.olderThan ?? cliArgs.garbageMaxAge ?? 24;
      const output = await provider.garbageCollect(
        params.filter || '',
        previewOnly,
        olderThan,
        params.fullCache ?? false,
        params.baseDependencies ?? false,
      );
      return { success: true, output };
    }

    case 'list-resources': {
      const result = await provider.listResources();
      return { success: true, result };
    }

    case 'list-workflow': {
      const result = await provider.listWorkflow();
      return { success: true, result };
    }

    case 'watch-workflow': {
      const output = await provider.watchWorkflow();
      return { success: true, output };
    }

    default:
      return { success: false, error: `Unknown command: ${command}` };
  }
}

/**
 * Load a built-in provider by strategy name.
 * Uses direct imports to avoid the provider-loader URL parser routing
 * built-in names like "test" or "aws" to the npm case.
 */
async function loadBuiltinProvider(
  strategy: string,
  buildParameters: BuildParameters,
): Promise<ProviderInterface> {
  const providerMap: Record<string, () => Promise<any>> = {
    aws: () => import('../../model/orchestrator/providers/aws'),
    k8s: () => import('../../model/orchestrator/providers/k8s'),
    'local-docker': () => import('../../model/orchestrator/providers/docker'),
    'local-system': () => import('../../model/orchestrator/providers/local'),
    local: () => import('../../model/orchestrator/providers/local'),
    test: () => import('../../model/orchestrator/providers/test'),
    'gcp-cloud-run': () => import('../../model/orchestrator/providers/gcp-cloud-run'),
    'azure-aci': () => import('../../model/orchestrator/providers/azure-aci'),
    'github-actions': () => import('../../model/orchestrator/providers/github-actions'),
    'gitlab-ci': () => import('../../model/orchestrator/providers/gitlab-ci'),
    'remote-powershell': () => import('../../model/orchestrator/providers/remote-powershell'),
    ansible: () => import('../../model/orchestrator/providers/ansible'),
  };

  const loader = providerMap[strategy];
  if (!loader) {
    // Fall back to dynamic import for external/custom providers
    const loadProvider = (await import('../../model/orchestrator/providers/provider-loader'))
      .default;
    return loadProvider(strategy, buildParameters);
  }

  const mod = await loader();
  const Provider = mod.default || mod;
  return new Provider(buildParameters);
}

export default serveCommand;
