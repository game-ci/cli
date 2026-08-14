import path from 'path';

export interface RunnerContext {
  runnerTemporaryPath: string;
  githubAction: string;
}

const Action = {
  get supportedPlatforms() {
    return ['linux', 'win32'];
  },

  get isRunningLocally() {
    return process.env.RUNNER_WORKSPACE === undefined;
  },

  get isRunningFromSource() {
    return path.basename(__dirname) === 'model';
  },

  get canonicalName() {
    return 'unity-test-runner';
  },

  // Path depth updated for this repo's layout: model/action.ts now lives at
  // src/unity-test-runner/model/action.ts, one level deeper than the
  // original game-ci/unity-test-runner repo (this repo hosts multiple
  // engines' logic as sibling folders under src/ — see roadmap#11
  // workstream 2). Source and compiled builds have the same depth here
  // since plain tsc (not a single-file bundler) preserves the
  // src/unity-test-runner/model/ structure under dist/.
  get rootFolder() {
    return path.dirname(path.dirname(__filename));
  },

  get actionFolder() {
    return `${Action.rootFolder}/dist`;
  },

  get workspace() {
    return process.env.GITHUB_WORKSPACE;
  },

  runnerContext(): RunnerContext {
    const runnerTemporaryPath = process.env.RUNNER_TEMP ?? process.cwd();
    const githubAction = process.env.GITHUB_ACTION ?? process.pid.toString();

    return {
      runnerTemporaryPath,
      githubAction,
    };
  },

  checkCompatibility() {
    const currentPlatform = process.platform;
    if (!Action.supportedPlatforms.includes(currentPlatform)) {
      throw new Error(`Currently ${currentPlatform}-platform is not supported`);
    }
  },
};

export default Action;
