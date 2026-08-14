/**
 * Bridge file — stub for Action.
 *
 * The orchestrator's docker provider imports Action for workspace path.
 */

class Action {
  static get supportedPlatforms(): string[] {
    return ['linux', 'win32', 'darwin'];
  }

  static get isRunningLocally(): boolean {
    return !process.env.GITHUB_ACTIONS;
  }

  static get canonicalName(): string {
    return 'unity-builder';
  }

  static get rootFolder(): string {
    return process.cwd();
  }

  static get actionFolder(): string {
    return `${Action.rootFolder}/dist`;
  }

  static get workspace(): string {
    return process.env.GITHUB_WORKSPACE || process.cwd();
  }

  static checkCompatibility(): void {
    if (!Action.supportedPlatforms.includes(process.platform)) {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
  }
}

export default Action;
export { Action };
