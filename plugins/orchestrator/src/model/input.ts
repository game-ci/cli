/**
 * Bridge file — stub for Input.
 *
 * In unity-builder Input reads from @actions/core.getInput (GitHub Actions)
 * or Cli.query (CLI mode).  The orchestrator only uses a small subset.
 *
 * During Phase 3 of extraction this will become a proper InputProvider interface.
 */

import * as core from '@actions/core';
import { Cli } from './cli/cli';

class Input {
  static getInput(query: string): string | undefined {
    if (Cli.isCliMode) {
      return Cli.query(query, Input.ToEnvVarFormat(query));
    }

    // Check Cli.options as a fallback (used by tests that set overrides without CLI mode)
    const cliResult = Cli.query(query, Input.ToEnvVarFormat(query));
    if (cliResult !== undefined) {
      return cliResult;
    }

    return core.getInput(query) || undefined;
  }

  static ToEnvVarFormat(input: string): string {
    if (!input) return '';

    return input
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
  }

  // ── getters used by orchestrator code ────────────────────────────────

  static get region(): string {
    return this.getInput('region') || 'eu-west-2';
  }

  static get editorVersion(): string {
    return this.getInput('unityVersion') || '';
  }

  static get targetPlatform(): string {
    return this.getInput('targetPlatform') || 'StandaloneLinux64';
  }

  static get projectPath(): string {
    return this.getInput('projectPath') || '.';
  }

  static get buildName(): string {
    return this.getInput('buildName') || this.targetPlatform;
  }

  static get buildsPath(): string {
    return this.getInput('buildsPath') || './build';
  }

  static get customImage(): string {
    return this.getInput('customImage') || '';
  }

  static get dockerWorkspacePath(): string {
    return this.getInput('dockerWorkspacePath') || '/github/workspace';
  }

  static get providerStrategy(): string {
    return this.getInput('providerStrategy') || 'local';
  }

  static get gitSha(): string {
    return this.getInput('gitSha') || process.env.GITHUB_SHA || '';
  }

  static get branch(): string {
    return this.getInput('branch') || '';
  }

  static get runNumber(): string {
    return this.getInput('runNumber') || process.env.GITHUB_RUN_NUMBER || '0';
  }

  static get manualExit(): boolean {
    return this.getInput('manualExit') === 'true';
  }

  static get enableGpu(): boolean {
    return this.getInput('enableGpu') === 'true';
  }

  static get allowDirtyBuild(): boolean {
    return this.getInput('allowDirtyBuild') === 'true';
  }

  static get cacheUnityInstallationOnMac(): boolean {
    return this.getInput('cacheUnityInstallationOnMac') === 'true';
  }

  static get syncStrategy(): string {
    return this.getInput('syncStrategy') || 'full';
  }

  // Catch-all for any input key
  static [key: string]: any;
}

export type InputKey = keyof typeof Input;

export default Input;
export { Input };
