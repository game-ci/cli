import BuildParameters from '../../build-parameters';
import Orchestrator from '../orchestrator';
import { BuildAutomationWorkflow } from './build-automation-workflow';

function makeBuildParameters(overrides: Partial<BuildParameters> = {}): BuildParameters {
  const bp = new BuildParameters();
  bp.providerStrategy = 'local';
  bp.commandHooks = '';
  bp.cacheKey = 'test-cache-key';
  bp.projectPath = 'test-project';
  bp.targetPlatform = 'StandaloneLinux64';
  bp.buildName = 'StandaloneLinux64';
  bp.buildPath = 'build/StandaloneLinux64';
  bp.buildFile = 'StandaloneLinux64';
  bp.buildMethod = '';
  bp.buildVersion = '0.0.1';
  bp.androidVersionCode = '';
  bp.chownFilesTo = '';
  bp.manualExit = false;
  bp.buildProfile = '';
  bp.skipActivation = false;
  bp.dockerWorkspacePath = '/github/workspace';
  bp.orchestratorRepoName = 'game-ci/orchestrator';
  bp.orchestratorBranch = 'main';
  bp.gitAuthMode = 'header';
  bp.logId = 'test-log-id';
  bp.buildGuid = 'test-build-guid';
  bp.maxRetainedWorkspaces = 0;
  bp.repoPathOverride = '';

  return Object.assign(bp, overrides);
}

// The workflow script generator is a private static getter -- access it the
// same way the rest of this codebase reaches into internals under test.
function getBuildWorkflow(): string {
  return (BuildAutomationWorkflow as any).BuildWorkflow;
}

describe('BuildAutomationWorkflow.BuildWorkflow (local/local-system branch)', () => {
  afterEach(() => {
    Orchestrator.buildParameters = undefined as any;
  });

  it.each(['local', 'local-system'])(
    'invokes the shared runsteps.sh/STEPS_DIR chain for providerStrategy=%s instead of the log-stream/post-build-only stub',
    (providerStrategy) => {
      Orchestrator.buildParameters = makeBuildParameters({ providerStrategy });

      const script = getBuildWorkflow();

      expect(script).toContain('runsteps.sh');
      expect(script).toContain('STEPS_DIR');
      expect(script).toMatch(/platforms[\\/]ubuntu[\\/]steps/);
      // Must actually reach into the shared step chain, not just the old stub
      // (log-stream wrapping nothing, then post-build bookkeeping).
      expect(script).toContain('remote-cli-post-build');
    },
  );

  it('does not clone a repo or pull LFS for the local provider (project assumed already on disk)', () => {
    Orchestrator.buildParameters = makeBuildParameters({ providerStrategy: 'local' });

    const script = getBuildWorkflow();

    expect(script).not.toContain('git clone');
    expect(script).not.toContain('git lfs pull');
  });

  it('sets GITHUB_WORKSPACE to the local working directory for the local provider', () => {
    Orchestrator.buildParameters = makeBuildParameters({ providerStrategy: 'local' });

    const script = getBuildWorkflow();

    expect(script).toContain('export GITHUB_WORKSPACE=');
    expect(script).toContain('Using local workspace');
  });

  it('threads skipActivation from BuildParameters into SKIP_ACTIVATION=true in the generated script', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      skipActivation: true,
    });

    const script = getBuildWorkflow();

    expect(script).toContain('export SKIP_ACTIVATION="true"');
  });

  it('leaves SKIP_ACTIVATION unset (empty) when skipActivation is false', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      skipActivation: false,
    });

    const script = getBuildWorkflow();

    expect(script).toContain('export SKIP_ACTIVATION=""');
  });

  it('maps core BuildParameters fields to the env vars build.sh/activate.sh read', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      projectPath: 'MyUnityProject',
      targetPlatform: 'StandaloneWindows64',
      buildName: 'MyBuild',
      buildMethod: 'MyNamespace.Builder.Build',
    });

    const script = getBuildWorkflow();

    expect(script).toContain('export PROJECT_PATH="MyUnityProject"');
    expect(script).toContain('export BUILD_TARGET="StandaloneWindows64"');
    expect(script).toContain('export BUILD_NAME="MyBuild"');
    expect(script).toContain('export BUILD_METHOD="MyNamespace.Builder.Build"');
  });

  it('still uses the log-stream/post-build-only stub for non-local, non-containerized providers (e.g. test)', () => {
    Orchestrator.buildParameters = makeBuildParameters({ providerStrategy: 'test' });

    const script = getBuildWorkflow();

    expect(script).not.toContain('runsteps.sh');
    expect(script).toContain('remote-cli-log-stream');
    expect(script).toContain('remote-cli-post-build');
  });

  it('does not touch the local-docker containerized branch', () => {
    Orchestrator.buildParameters = makeBuildParameters({ providerStrategy: 'local-docker' });

    const script = getBuildWorkflow();

    expect(script).toContain('/entrypoint.sh');
    expect(script).not.toContain('STEPS_DIR');
  });
});
