import path from 'node:path';

class Action {
  static get supportedPlatforms(): string[] {
    return ['linux', 'win32', 'darwin'];
  }

  static get isRunningLocally(): boolean {
    return process.env.RUNNER_WORKSPACE === undefined;
  }

  static get isRunningFromSource(): boolean {
    return path.basename(__dirname) === 'model';
  }

  static get canonicalName(): string {
    return 'unity-builder';
  }

  // Path depth updated for this repo's layout: model/action.ts now lives at
  // src/unity-builder/model/action.ts, one level deeper than the original
  // game-ci/unity-builder repo (this repo hosts multiple engines' logic as
  // sibling folders under src/ — see roadmap#11 workstream 2). Source and
  // compiled builds have the same depth here since plain tsc (not a
  // single-file bundler) preserves the src/unity-builder/model/ structure
  // under dist/.
  static get rootFolder(): string {
    return path.dirname(path.dirname(__filename));
  }

  static get actionFolder(): string {
    return `${Action.rootFolder}/dist`;
  }

  static get workspace(): string {
    return process.env.GITHUB_WORKSPACE!;
  }

  static checkCompatibility() {
    const currentPlatform = process.platform;
    if (!Action.supportedPlatforms.includes(currentPlatform)) {
      throw new Error(`Currently ${currentPlatform}-platform is not supported`);
    }
  }
}

export default Action;
