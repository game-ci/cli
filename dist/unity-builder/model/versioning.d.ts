export default class Versioning {
    static get strategies(): {
        None: string;
        Semantic: string;
        Tag: string;
        Custom: string;
    };
    static get grepCompatibleInputVersionRegex(): string;
    /**
     * Get the branch name of the (related) branch
     */
    static get branch(): string | undefined;
    /**
     * For pull requests we can reliably use GITHUB_HEAD_REF
     */
    static get headRef(): string | undefined;
    /**
     * For branches GITHUB_REF will have format `refs/heads/feature-branch-1`
     */
    static get ref(): string | undefined;
    /**
     * Maximum number of lines to print when logging the git diff
     */
    static get maxDiffLines(): number;
    /**
     * Log up to maxDiffLines of the git diff.
     */
    static logDiff(): Promise<void>;
    /**
     * Regex to parse version description into separate fields
     */
    static get descriptionRegexes(): RegExp[];
    static determineBuildVersion(strategy: string, inputVersion: string): Promise<string>;
    /**
     * Automatically generates a version based on SemVer out of the box.
     *
     * The version works as follows: `<major>.<minor>.<patch>` for example `0.1.2`.
     *
     * The latest tag dictates `<major>.<minor>`
     * The number of commits since that tag dictates`<patch>`.
     *
     * @See: https://semver.org/
     */
    static generateSemanticVersion(): Promise<string>;
    /**
     * Generate the proper version for unity based on an existing tag.
     */
    static generateTagVersion(): Promise<string>;
    /**
     * Parses the versionDescription into their named parts.
     */
    static parseSemanticVersion(): Promise<false | {
        match: string;
        tag: string;
        commits: string;
        hash: string;
    }>;
    /**
     * Returns whether the repository is shallow.
     */
    static isShallow(): Promise<boolean>;
    /**
     * Retrieves refs from the configured remote.
     *
     * Fetch unshallow for incomplete repository, but fall back to normal fetch.
     *
     * Note: `--all` should not be used, and would break fetching for push event.
     */
    static fetch(): Promise<void>;
    /**
     * Retrieves information about the branch.
     *
     * Format: `v0.12-24-gd2198ab`
     *
     * In this format v0.12 is the latest tag, 24 are the number of commits since, and gd2198ab
     * identifies the current commit.
     */
    static getVersionDescription(): Promise<string>;
    /**
     * Returns whether there are uncommitted changes that are not ignored.
     */
    static isDirty(): Promise<boolean>;
    /**
     * Get the tag if there is one pointing at HEAD
     */
    static getTag(): Promise<string>;
    /**
     * Whether the current tree has any version tags yet.
     *
     * Note: Currently this is run in all OSes, so the syntax must be cross-platform.
     */
    static hasAnyVersionTags(): Promise<boolean>;
    /**
     * Get the total number of commits on head.
     *
     */
    static getTotalNumberOfCommits(): Promise<number>;
    /**
     * Run git in the specified project path
     */
    static git(arguments_: string[], options?: {}): Promise<string>;
}
