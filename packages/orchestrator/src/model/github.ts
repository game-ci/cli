/**
 * Bridge file — stub for GitHub.
 *
 * In unity-builder this wraps @octokit/core to create and update GitHub
 * check runs.  The orchestrator uses it for CI feedback during remote builds.
 *
 * During Phase 3 this will become a proper CIFeedbackProvider interface.
 */

import * as core from '@actions/core';

class GitHub {
  static githubInputEnabled = true;
  static result = '';
  static forceAsyncTest = false;

  static async createGitHubCheck(summary: string): Promise<string> {
    if (!GitHub.githubInputEnabled) {
      core.info('[GitHub] GitHub input disabled, skipping check creation');

      return '';
    }
    core.info(`[GitHub] createGitHubCheck: ${summary}`);

    // Stub: return empty check ID — real implementation uses Octokit
    return '';
  }

  static async updateGitHubCheck(
    longDescription: string,
    summary: string,
    result = 'neutral',
    status = 'in_progress',
  ): Promise<void> {
    if (!GitHub.githubInputEnabled) return;
    core.info(`[GitHub] updateGitHubCheck: status=${status}, result=${result}, summary=${summary}`);
  }

  static async triggerWorkflowOnComplete(triggerWorkflowOnComplete: string[]): Promise<void> {
    if (!triggerWorkflowOnComplete || triggerWorkflowOnComplete.length === 0) return;
    core.info(`[GitHub] triggerWorkflowOnComplete: ${triggerWorkflowOnComplete.join(', ')}`);
  }

  static async createGitHubCheckRequest(_data: any): Promise<any> {
    return {};
  }

  static async updateGitHubCheckRequest(_data: any): Promise<any> {
    return {};
  }

  static async getCheckStatus(): Promise<any> {
    return {};
  }

  static async runUpdateAsyncChecksWorkflow(_data: any, _mode: string): Promise<void> {
    // stub
  }
}

export default GitHub;
export { GitHub };
