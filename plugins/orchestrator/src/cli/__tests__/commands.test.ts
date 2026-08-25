import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import buildCommand from '../commands/build';
import activateCommand from '../commands/activate';
import orchestrateCommand from '../commands/orchestrate';
import statusCommand from '../commands/status';
import versionCommand from '../commands/version';
import updateCommand from '../commands/update';
import remoteCliPreBuildCommand from '../commands/remote-cli-pre-build';
import remoteCliLogStreamCommand from '../commands/remote-cli-log-stream';
import remoteCliPostBuildCommand from '../commands/remote-cli-post-build';

function createFakeYargs(): { yargs: any; options: Record<string, any> } {
  const options: Record<string, any> = {};
  const yargs: any = {
    option: vi.fn(),
    positional: vi.fn(),
    example: vi.fn(),
    env: vi.fn(),
    command: vi.fn(),
  };

  yargs.option.mockImplementation((name: string, config: any) => {
    options[name] = config;

    return yargs;
  });
  yargs.positional.mockImplementation((name: string, config: any) => {
    options[name] = config;

    return yargs;
  });
  yargs.example.mockReturnValue(yargs);
  yargs.env.mockReturnValue(yargs);
  yargs.command.mockReturnValue(yargs);

  return { yargs, options };
}

describe('CLI commands', () => {
  describe('build command', () => {
    it('exports the correct command name', () => {
      expect(buildCommand.command).toStrictEqual('build');
    });

    it('has a description', () => {
      expect(buildCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof buildCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof buildCommand.handler).toStrictEqual('function');
    });

    it('defines all expected build flags via builder', () => {
      const { yargs, options } = createFakeYargs();

      (buildCommand.builder as Function)(yargs);

      expect(options['target-platform']).toBeDefined();
      expect(options['target-platform'].demandOption).toStrictEqual(true);
      expect(options['unity-version']).toBeDefined();
      expect(options['project-path']).toBeDefined();
      expect(options['build-name']).toBeDefined();
      expect(options['builds-path']).toBeDefined();
      expect(options['build-method']).toBeDefined();
      expect(options['custom-parameters']).toBeDefined();
      expect(options['versioning']).toBeDefined();
      expect(options['version']).toBeDefined();
      expect(options['custom-image']).toBeDefined();
      expect(options['manual-exit']).toBeDefined();
      expect(options['enable-gpu']).toBeDefined();

      expect(options['android-version-code']).toBeDefined();
      expect(options['android-export-type']).toBeDefined();
      expect(options['android-keystore-name']).toBeDefined();
      expect(options['android-keystore-base64']).toBeDefined();
      expect(options['android-keystore-pass']).toBeDefined();
      expect(options['android-keyalias-name']).toBeDefined();
      expect(options['android-keyalias-pass']).toBeDefined();
      expect(options['android-target-sdk-version']).toBeDefined();
      expect(options['android-symbol-type']).toBeDefined();

      expect(options['docker-cpu-limit']).toBeDefined();
      expect(options['docker-memory-limit']).toBeDefined();
      expect(options['docker-workspace-path']).toBeDefined();
      expect(options['run-as-host-user']).toBeDefined();
      expect(options['chown-files-to']).toBeDefined();

      expect(options['provider-strategy']).toBeDefined();

      // Engine-specific licensing flags are intentionally NOT defined on
      // orchestrator's build command — orchestrator is engine-agnostic.
      // Hosts (unity-builder action, @game-ci/cli) own those flags and pass
      // them through to the build container as environment variables.
      // See https://github.com/game-ci/orchestrator/issues/25
      expect(options['skip-activation']).toBeUndefined();
      expect(options['unity-licensing-server']).toBeUndefined();
      expect(options['unity-licensing-toolset']).toBeUndefined();
    });

    it('sets correct default values', () => {
      const { yargs, options } = createFakeYargs();

      (buildCommand.builder as Function)(yargs);

      expect(options['unity-version'].default).toStrictEqual('auto');
      expect(options['project-path'].default).toStrictEqual('.');
      expect(options['builds-path'].default).toStrictEqual('build');
      expect(options['versioning'].default).toStrictEqual('Semantic');
      expect(options['manual-exit'].default).toStrictEqual(false);
      expect(options['enable-gpu'].default).toStrictEqual(false);
      expect(options['android-export-type'].default).toStrictEqual('androidPackage');
      expect(options['android-symbol-type'].default).toStrictEqual('none');
      expect(options['provider-strategy'].default).toStrictEqual('local');
    });

    it('provides camelCase aliases for kebab-case options', () => {
      const { yargs, options } = createFakeYargs();

      (buildCommand.builder as Function)(yargs);

      expect(options['target-platform'].alias).toStrictEqual('targetPlatform');
      expect(options['unity-version'].alias).toStrictEqual('unityVersion');
      expect(options['project-path'].alias).toStrictEqual('projectPath');
      expect(options['build-name'].alias).toStrictEqual('buildName');
      expect(options['builds-path'].alias).toStrictEqual('buildsPath');
      expect(options['build-method'].alias).toStrictEqual('buildMethod');
    });
  });

  describe('activate command', () => {
    it('exports the correct command name', () => {
      expect(activateCommand.command).toStrictEqual('activate');
    });

    it('has a description', () => {
      expect(activateCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof activateCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof activateCommand.handler).toStrictEqual('function');
    });
  });

  describe('orchestrate command', () => {
    it('exports the correct command name', () => {
      expect(orchestrateCommand.command).toStrictEqual('orchestrate');
    });

    it('has a description', () => {
      expect(orchestrateCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof orchestrateCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof orchestrateCommand.handler).toStrictEqual('function');
    });

    it('defines key orchestrator flags', () => {
      const { yargs, options } = createFakeYargs();

      (orchestrateCommand.builder as Function)(yargs);

      expect(options['target-platform']).toBeDefined();
      expect(options['provider-strategy']).toBeDefined();
      expect(options['provider-strategy'].default).toStrictEqual('aws');
      expect(options['aws-stack-name']).toBeDefined();
      expect(options['kube-config']).toBeDefined();
      expect(options['kube-volume']).toBeDefined();
      expect(options['cache-key']).toBeDefined();
      expect(options['watch-to-end']).toBeDefined();
      expect(options['clone-depth']).toBeDefined();
    });

    it('registers cache as a subcommand', () => {
      const { yargs } = createFakeYargs();

      (orchestrateCommand.builder as Function)(yargs);

      expect(yargs.command).toHaveBeenCalled();
    });
  });

  describe('status command', () => {
    it('exports the correct command name', () => {
      expect(statusCommand.command).toStrictEqual('status');
    });

    it('has a description', () => {
      expect(statusCommand.describe).toBeTruthy();
    });

    it('has a handler function', () => {
      expect(typeof statusCommand.handler).toStrictEqual('function');
    });
  });

  describe('version command', () => {
    it('exports the correct command name', () => {
      expect(versionCommand.command).toStrictEqual('version');
    });

    it('has a description', () => {
      expect(versionCommand.describe).toBeTruthy();
    });

    it('has a handler function', () => {
      expect(typeof versionCommand.handler).toStrictEqual('function');
    });
  });

  describe('update command', () => {
    it('exports the correct command name', () => {
      expect(updateCommand.command).toStrictEqual('update');
    });

    it('has a description', () => {
      expect(updateCommand.describe).toBeTruthy();
    });

    it('has a builder function', () => {
      expect(typeof updateCommand.builder).toStrictEqual('function');
    });

    it('has a handler function', () => {
      expect(typeof updateCommand.handler).toStrictEqual('function');
    });

    it('defines force and version flags', () => {
      const { yargs, options } = createFakeYargs();

      (updateCommand.builder as Function)(yargs);

      expect(options['force']).toBeDefined();
      expect(options['force'].type).toStrictEqual('boolean');
      expect(options['force'].default).toStrictEqual(false);
      expect(options['version']).toBeDefined();
      expect(options['version'].type).toStrictEqual('string');
    });
  });

  // These three run inside the remote build container (AWS/K8s), dispatched
  // by build-automation-workflow.ts's generated shell scripts. They used to
  // be reached via a bespoke `-m <name>` flag from when this package had its
  // own argv-based CliFunction dispatcher; that dispatcher no longer exists
  // in either this package's yargs-based src/cli.ts or game-ci/cli's, so
  // `-m` was rejected by strict-mode yargs as an unknown argument -
  // silently breaking every remote build's pre-build, log-streaming and
  // post-build steps. These commands restore real yargs entry points for
  // them; regression tests exist so this cannot silently regress again by,
  // say, a rename in build-automation-workflow.ts drifting out of sync with
  // the command name registered here.
  describe('remote-cli-pre-build command', () => {
    it('exports the correct command name', () => {
      expect(remoteCliPreBuildCommand.command).toStrictEqual('remote-cli-pre-build');
    });

    it('has a description', () => {
      expect(remoteCliPreBuildCommand.describe).toBeTruthy();
    });

    it('has a handler function', () => {
      expect(typeof remoteCliPreBuildCommand.handler).toStrictEqual('function');
    });

    it('takes no required options - the original bare invocation took none', () => {
      expect(remoteCliPreBuildCommand.builder).toBeUndefined();
    });
  });

  describe('remote-cli-log-stream command', () => {
    it('exports the correct command name', () => {
      expect(remoteCliLogStreamCommand.command).toStrictEqual('remote-cli-log-stream');
    });

    it('has a description', () => {
      expect(remoteCliLogStreamCommand.describe).toBeTruthy();
    });

    it('has a handler function', () => {
      expect(typeof remoteCliLogStreamCommand.handler).toStrictEqual('function');
    });

    it('requires --log-file, aliased to logFile to match the shell scripts that invoke it', () => {
      const { yargs, options } = createFakeYargs();

      (remoteCliLogStreamCommand.builder as Function)(yargs);

      expect(options['log-file']).toBeDefined();
      expect(options['log-file'].alias).toStrictEqual('logFile');
      expect(options['log-file'].demandOption).toStrictEqual(true);
    });
  });

  describe('remote-cli-post-build command', () => {
    it('exports the correct command name', () => {
      expect(remoteCliPostBuildCommand.command).toStrictEqual('remote-cli-post-build');
    });

    it('has a description', () => {
      expect(remoteCliPostBuildCommand.describe).toBeTruthy();
    });

    it('has a handler function', () => {
      expect(typeof remoteCliPostBuildCommand.handler).toStrictEqual('function');
    });

    it('takes no required options - the original bare invocation took none', () => {
      expect(remoteCliPostBuildCommand.builder).toBeUndefined();
    });
  });
});
