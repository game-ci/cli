import System from '../../model/system/system.ts';

export class GitDetector {
  private readonly projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  public async isGitRepository() {
    const { status } = await System.run(`git -C '${this.projectPath}' rev-parse`, undefined, { silent: true});

    return status?.code === 0;
  }

  public async getCurrentBranch() {
    // GitHub pull request, GitHub non pull request
    let branchName = this.headRef || this.ref?.slice(11);

    // Local
    if (!branchName) {
      const { status, output } = await System.run('git branch --show-current', undefined, { cwd: this.projectPath });
      if (!status?.success) throw new Error('did not expect "git branch --show-current"');
      branchName = output;
    }

    return branchName;
  }

  /**
   * For pull requests we can reliably use GITHUB_HEAD_REF
   * @deprecated
   */
  private get headRef() {
    return Deno.env.get('GITHUB_HEAD_REF');
  }

  /**
   * For branches GITHUB_REF will have format `refs/heads/feature-branch-1`
   * @deprecated
   */
  private get ref() {
    return Deno.env.get('GITHUB_REF');
  }
}
