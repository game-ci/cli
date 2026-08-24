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

  it('threads engineLaunchWrapper from BuildParameters into ENGINE_LAUNCH_WRAPPER in the generated script', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      engineLaunchWrapper: 'flock /tmp/engine.lock --',
    });

    const script = getBuildWorkflow();

    expect(script).toContain('export ENGINE_LAUNCH_WRAPPER="flock /tmp/engine.lock --"');
  });

  it('leaves ENGINE_LAUNCH_WRAPPER unset (empty) when engineLaunchWrapper is not set', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      engineLaunchWrapper: '',
    });

    const script = getBuildWorkflow();

    expect(script).toContain('export ENGINE_LAUNCH_WRAPPER=""');
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

describe('BuildAutomationWorkflow.BuildWorkflow -- middleware command-hook wiring', () => {
  afterEach(() => {
    Orchestrator.buildParameters = undefined as any;
  });

  it('produces byte-identical output with no middleware configured (regression guard)', () => {
    const withoutMiddleware = makeBuildParameters({ commandHooks: '' });
    Orchestrator.buildParameters = withoutMiddleware;
    const scriptWithoutField = getBuildWorkflow();

    const withEmptyMiddleware = makeBuildParameters({
      commandHooks: '',
      middlewarePipeline: '',
    });
    Orchestrator.buildParameters = withEmptyMiddleware;
    const scriptWithEmptyMiddleware = getBuildWorkflow();

    expect(scriptWithEmptyMiddleware).toBe(scriptWithoutField);
  });

  it('inserts a command-type middleware before/after command at the setup phase', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `
name: setup-mw
type: command
trigger:
  phase: [setup]
before:
  commands: echo "setup-mw-before"
after:
  commands: echo "setup-mw-after"
`,
    });

    const script = getBuildWorkflow();

    expect(script).toContain('echo "setup-mw-before"');
    expect(script).toContain('echo "setup-mw-after"');
    // Should appear before the toolchain-setup marker's "after" position and
    // around the setup commands, not inside the build-phase section.
    const beforeIndex = script.indexOf('echo "setup-mw-before"');
    const setupCommandsIndex = script.indexOf('export CACHE_KEY=');
    expect(beforeIndex).toBeLessThan(setupCommandsIndex);
  });

  it('inserts a command-type middleware before/after command at the build phase', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `
name: build-mw
type: command
trigger:
  phase: [build]
before:
  commands: echo "build-mw-before"
after:
  commands: echo "build-mw-after"
`,
    });

    const script = getBuildWorkflow();

    expect(script).toContain('echo "build-mw-before"');
    expect(script).toContain('echo "build-mw-after"');
    const buildBeforeIndex = script.indexOf('echo "build-mw-before"');
    const buildRunIndex = script.indexOf('remote-cli-log-stream');
    const buildAfterIndex = script.indexOf('echo "build-mw-after"');
    expect(buildBeforeIndex).toBeLessThan(buildRunIndex);
    expect(buildAfterIndex).toBeGreaterThan(buildRunIndex);
  });

  it('filters out middleware whose trigger phase does not match either slot', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `
name: prebuild-only-mw
type: command
trigger:
  phase: [pre-build]
before:
  commands: echo "should-not-appear"
`,
    });

    const script = getBuildWorkflow();

    expect(script).not.toContain('should-not-appear');
  });

  it('filters out middleware whose trigger provider does not match providerStrategy', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      middlewarePipeline: `
name: aws-only-mw
type: command
trigger:
  phase: [build]
  provider: [aws]
before:
  commands: echo "aws-only-command"
`,
    });

    const script = getBuildWorkflow();

    expect(script).not.toContain('aws-only-command');
  });

  it('includes middleware whose trigger provider matches providerStrategy', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      providerStrategy: 'local',
      middlewarePipeline: `
name: local-only-mw
type: command
trigger:
  phase: [build]
  provider: [local]
before:
  commands: echo "local-only-command"
`,
    });

    const script = getBuildWorkflow();

    expect(script).toContain('echo "local-only-command"');
  });

  it('filters out middleware whose trigger platform does not match targetPlatform', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      targetPlatform: 'StandaloneLinux64',
      middlewarePipeline: `
name: windows-only-mw
type: command
trigger:
  phase: [build]
  platform: [StandaloneWindows64]
before:
  commands: echo "windows-only-command"
`,
    });

    const script = getBuildWorkflow();

    expect(script).not.toContain('windows-only-command');
  });

  it('evaluates a truthy env.VAR trigger expression', () => {
    process.env.MW_FEATURE_FLAG = 'true';
    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `
name: flagged-mw
type: command
trigger:
  phase: [build]
  when: "env.MW_FEATURE_FLAG == 'true'"
before:
  commands: echo "flag-on-command"
`,
    });

    const script = getBuildWorkflow();

    expect(script).toContain('echo "flag-on-command"');
    delete process.env.MW_FEATURE_FLAG;
  });

  it('excludes middleware when the when-expression evaluates falsy', () => {
    process.env.MW_FEATURE_FLAG = 'false';
    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `
name: flagged-mw
type: command
trigger:
  phase: [build]
  when: "env.MW_FEATURE_FLAG == 'true'"
before:
  commands: echo "flag-off-command"
`,
    });

    const script = getBuildWorkflow();

    expect(script).not.toContain('flag-off-command');
    delete process.env.MW_FEATURE_FLAG;
  });

  it('merges legacy command hooks and middleware, legacy first, at the same slot', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      commandHooks: `
- name: legacy-build-hook
  hook: [before]
  step: [build]
  commands: echo "legacy-command"
`,
      middlewarePipeline: `
name: merge-mw
type: command
trigger:
  phase: [build]
before:
  commands: echo "middleware-command"
`,
    });

    const script = getBuildWorkflow();

    expect(script).toContain('echo "legacy-command"');
    expect(script).toContain('echo "middleware-command"');
    const legacyIndex = script.indexOf('echo "legacy-command"');
    const middlewareIndex = script.indexOf('echo "middleware-command"');
    expect(legacyIndex).toBeLessThan(middlewareIndex);
  });

  it('orders multiple before-phase middleware by ascending priority (wrapping order)', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `
- name: low-priority-mw
  type: command
  priority: 10
  trigger:
    phase: [build]
  before:
    commands: echo "low-priority-command"
- name: high-priority-mw
  type: command
  priority: 90
  trigger:
    phase: [build]
  before:
    commands: echo "high-priority-command"
`,
    });

    const script = getBuildWorkflow();

    const lowIndex = script.indexOf('echo "low-priority-command"');
    const highIndex = script.indexOf('echo "high-priority-command"');
    expect(lowIndex).toBeGreaterThan(-1);
    expect(highIndex).toBeGreaterThan(-1);
    expect(lowIndex).toBeLessThan(highIndex);
  });

  it('does not crash and skips malformed inline middleware YAML', () => {
    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `not: [valid, yaml, : : broken`,
    });

    expect(() => getBuildWorkflow()).not.toThrow();
  });

  it('calls MiddlewareService.getMiddleware once per BuildWorkflow evaluation, not once per slot', async () => {
    const { MiddlewareService } = await import('../services/hooks/middleware-service');
    const spy = vi.spyOn(MiddlewareService, 'getMiddleware');

    Orchestrator.buildParameters = makeBuildParameters({
      middlewarePipeline: `
name: spy-mw
type: command
trigger:
  phase: [build]
before:
  commands: echo "spy-command"
`,
    });

    getBuildWorkflow();

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
