import orchestratorPlugin from './index';
import { createBuildParametersFromCliOptions } from './build-parameters-adapter';

describe('CLI Plugin Adapter', () => {
  describe('orchestratorPlugin', () => {
    it('has required GameCIPlugin fields', () => {
      expect(orchestratorPlugin.name).toBe('orchestrator');
      expect(orchestratorPlugin.version).toBe('1.0.0');
    });

    it('registers options plugin with wildcard engine', () => {
      expect(orchestratorPlugin.options).toHaveLength(1);
      expect(orchestratorPlugin.options[0].engine).toBe('*');
      expect(typeof orchestratorPlugin.options[0].configure).toBe('function');
    });

    it('exposes all built-in provider strategies', () => {
      const providers = orchestratorPlugin.providers;
      expect(providers).toHaveProperty('aws');
      expect(providers).toHaveProperty('k8s');
      expect(providers).toHaveProperty('local-docker');
      expect(providers).toHaveProperty('local-system');
      expect(providers).toHaveProperty('local');
      expect(providers).toHaveProperty('test');
      expect(providers).toHaveProperty('gcp-cloud-run');
      expect(providers).toHaveProperty('azure-aci');
      expect(providers).toHaveProperty('github-actions');
      expect(providers).toHaveProperty('gitlab-ci');
      expect(providers).toHaveProperty('remote-powershell');
      expect(providers).toHaveProperty('ansible');
      expect(providers).toHaveProperty('cli');
    });

    it('provider constructors are functions', () => {
      for (const [, Ctor] of Object.entries(orchestratorPlugin.providers)) {
        expect(typeof Ctor).toBe('function');
      }
    });
  });

  describe('configureOrchestratorOptions', () => {
    it('registers options on a yargs-like object', () => {
      const registered: Record<string, any> = {};
      const mockYargs = {
        option(name: string, config: any) {
          registered[name] = config;

          return mockYargs;
        },
      };

      orchestratorPlugin.options[0].configure(mockYargs);

      // Spot-check key options across categories
      expect(registered).toHaveProperty('containerCpu');
      expect(registered).toHaveProperty('containerMemory');
      expect(registered).toHaveProperty('awsStackName');
      expect(registered).toHaveProperty('awsUseSpot');
      expect(registered).toHaveProperty('kubeConfig');
      expect(registered).toHaveProperty('storageProvider');
      expect(registered).toHaveProperty('commandHooks');
      expect(registered).toHaveProperty('orchestratorDebug');
      expect(registered).toHaveProperty('region');
      expect(registered).toHaveProperty('engine');
      expect(registered).toHaveProperty('enginePlugin');
      expect(registered).toHaveProperty('fallbackProviderStrategy');
      expect(registered).toHaveProperty('hotRunnerEnabled');
      expect(registered).toHaveProperty('syncStrategy');
      expect(registered).toHaveProperty('githubActionsRepo');
      expect(registered).toHaveProperty('gitlabProjectId');
      expect(registered).toHaveProperty('remotePowershellHost');
      expect(registered).toHaveProperty('ansibleInventory');
      expect(registered).toHaveProperty('skipActivation');
      expect(registered.skipActivation.default).toBe(false);
      expect(registered).toHaveProperty('middlewarePipeline');
      expect(registered).toHaveProperty('middlewareFiles');
    });
  });

  describe('createBuildParametersFromCliOptions', () => {
    it('maps yargs options to BuildParameters', () => {
      const bp = createBuildParametersFromCliOptions({
        providerStrategy: 'aws',
        containerMemory: '4096',
        containerCpu: '2048',
        awsStackName: 'my-stack',
        targetPlatform: 'StandaloneLinux64',
        buildName: 'MyGame',
        kubeConfig: 'base64config',
        engine: 'unity',
      });

      expect(bp.providerStrategy).toBe('aws');
      expect(bp.containerMemory).toBe('4096');
      expect(bp.containerCpu).toBe('2048');
      expect(bp.awsStackName).toBe('my-stack');
      expect(bp.targetPlatform).toBe('StandaloneLinux64');
      expect(bp.buildName).toBe('MyGame');
      expect(bp.kubeConfig).toBe('base64config');
      expect(bp.isCliMode).toBe(true);
      expect(bp.engine).toBe('unity');
    });

    it('applies defaults for missing options', () => {
      const bp = createBuildParametersFromCliOptions({});

      expect(bp.providerStrategy).toBe('local-docker');
      expect(bp.containerMemory).toBe('3072');
      expect(bp.containerCpu).toBe('1024');
      expect(bp.awsStackName).toBe('game-ci');
      expect(bp.kubeVolumeSize).toBe('25Gi');
      expect(bp.storageProvider).toBe('s3');
      expect(bp.engine).toBe('unity');
    });

    it('maps skipInContainerClone (true) from boolean and string forms', () => {
      const fromBoolean = createBuildParametersFromCliOptions({ skipInContainerClone: true });
      expect(fromBoolean.skipInContainerClone).toBe(true);

      const fromString = createBuildParametersFromCliOptions({ skipInContainerClone: 'true' });
      expect(fromString.skipInContainerClone).toBe(true);
    });

    it('defaults skipInContainerClone to false when unset or falsy', () => {
      const unset = createBuildParametersFromCliOptions({});
      expect(unset.skipInContainerClone).toBe(false);

      const explicitFalse = createBuildParametersFromCliOptions({ skipInContainerClone: false });
      expect(explicitFalse.skipInContainerClone).toBe(false);

      const stringFalse = createBuildParametersFromCliOptions({ skipInContainerClone: 'false' });
      expect(stringFalse.skipInContainerClone).toBe(false);
    });

    it('maps repoPathOverride from string', () => {
      const bp = createBuildParametersFromCliOptions({ repoPathOverride: '/data' });
      expect(bp.repoPathOverride).toBe('/data');
    });

    it('defaults repoPathOverride to empty string when unset', () => {
      const unset = createBuildParametersFromCliOptions({});
      expect(unset.repoPathOverride).toBe('');

      const empty = createBuildParametersFromCliOptions({ repoPathOverride: '' });
      expect(empty.repoPathOverride).toBe('');
    });

    it('maps provider-specific fields', () => {
      const bp = createBuildParametersFromCliOptions({
        githubActionsRepo: 'owner/repo',
        githubActionsWorkflow: 'build.yml',
        gitlabProjectId: '12345',
        ansibleInventory: '/path/to/hosts',
        remotePowershellHost: 'win-server',
      });

      expect(bp.githubActionsRepo).toBe('owner/repo');
      expect(bp.githubActionsWorkflow).toBe('build.yml');
      expect(bp.gitlabProjectId).toBe('12345');
      expect(bp.ansibleInventory).toBe('/path/to/hosts');
      expect(bp.remotePowershellHost).toBe('win-server');
    });

    it('maps skipActivation (true) from boolean and string forms', () => {
      const fromBoolean = createBuildParametersFromCliOptions({ skipActivation: true });
      expect(fromBoolean.skipActivation).toBe(true);

      const fromString = createBuildParametersFromCliOptions({ skipActivation: 'true' });
      expect(fromString.skipActivation).toBe(true);
    });

    it('defaults skipActivation to false when unset or falsy', () => {
      const unset = createBuildParametersFromCliOptions({});
      expect(unset.skipActivation).toBe(false);

      const explicitFalse = createBuildParametersFromCliOptions({ skipActivation: false });
      expect(explicitFalse.skipActivation).toBe(false);

      const stringFalse = createBuildParametersFromCliOptions({ skipActivation: 'false' });
      expect(stringFalse.skipActivation).toBe(false);
    });

    it('maps middlewarePipeline from CLI options to BuildParameters', () => {
      const yaml = 'name: mw\ntype: command\ntrigger:\n  phase: [build]\nbefore: echo "hi"';
      const bp = createBuildParametersFromCliOptions({ middlewarePipeline: yaml });
      expect(bp.middlewarePipeline).toBe(yaml);
    });

    it('defaults middlewarePipeline to empty string when unset', () => {
      const bp = createBuildParametersFromCliOptions({});
      expect(bp.middlewarePipeline).toBe('');
    });
  });

  describe('middlewareFiles CLI reachability', () => {
    // middlewareFiles is read directly via OrchestratorOptions.getInput (the
    // same mechanism as commandHookFiles/containerHookFiles), not routed
    // through BuildParameters. Confirm it is actually wired end-to-end from
    // Cli.options through to OrchestratorOptions.middlewareFiles.
    afterEach(async () => {
      const { Cli } = await import('../model/cli/cli');
      Cli.options = undefined;
    });

    it('reads a comma-separated middlewareFiles CLI option through to OrchestratorOptions', async () => {
      const { Cli } = await import('../model/cli/cli');
      const { default: OrchestratorOptions } = await import(
        '../model/orchestrator/options/orchestrator-options'
      );

      Cli.options = { mode: 'cli', middlewareFiles: 'code-signing,cache-optimizer' } as any;

      expect(OrchestratorOptions.middlewareFiles).toEqual(['code-signing', 'cache-optimizer']);
    });

    it('defaults middlewareFiles to an empty array when unset', async () => {
      const { Cli } = await import('../model/cli/cli');
      const { default: OrchestratorOptions } = await import(
        '../model/orchestrator/options/orchestrator-options'
      );

      Cli.options = { mode: 'cli' } as any;

      expect(OrchestratorOptions.middlewareFiles).toEqual([]);
    });
  });
});
