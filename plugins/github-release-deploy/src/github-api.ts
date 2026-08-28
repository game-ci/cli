/**
 * Minimal GitHub Releases API client - just the four calls
 * github-release-deploy-command.ts needs (find-by-tag, create, list
 * assets, delete asset, upload asset). No octokit dependency: this repo
 * has no other GitHub API client to share, and pulling one in for four
 * endpoints isn't worth the dependency weight.
 */

export interface GitHubReleaseAsset {
  id: number;
  name: string;
}

export interface GitHubRelease {
  id: number;
  upload_url: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

export interface GitHubApiOptions {
  /** "owner/repo". */
  repo: string;
  /** Never logged, never passed as a CLI argument - read from GITHUB_TOKEN only. */
  token: string;
  /** Overridable for GitHub Enterprise Server; defaults to the public API. */
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
}

function headersFor(options: GitHubApiOptions, extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${options.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

function apiBase(options: GitHubApiOptions): string {
  return options.apiBaseUrl ?? "https://api.github.com";
}

/** Returns null if no release exists for the tag (a 404 is expected, not an error, on a first run). */
export async function getReleaseByTag(options: GitHubApiOptions, tag: string): Promise<GitHubRelease | null> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(`${apiBase(options)}/repos/${options.repo}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: headersFor(options),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to look up release for tag "${tag}": GitHub API returned ${response.status}.`);
  }
  return (await response.json()) as GitHubRelease;
}

export interface CreateReleaseOptions {
  tag: string;
  /** Defaults to tag when unset. */
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  /** Commit/branch the tag is created from, when the tag doesn't already exist. */
  targetCommitish?: string;
}

export async function createRelease(options: GitHubApiOptions, release: CreateReleaseOptions): Promise<GitHubRelease> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(`${apiBase(options)}/repos/${options.repo}/releases`, {
    method: "POST",
    headers: headersFor(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      tag_name: release.tag,
      name: release.name ?? release.tag,
      body: release.body,
      draft: release.draft ?? false,
      prerelease: release.prerelease ?? false,
      ...(release.targetCommitish ? { target_commitish: release.targetCommitish } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create release for tag "${release.tag}": GitHub API returned ${response.status}. ${text}`);
  }
  return (await response.json()) as GitHubRelease;
}

export async function deleteAsset(options: GitHubApiOptions, assetId: number): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(`${apiBase(options)}/repos/${options.repo}/releases/assets/${assetId}`, {
    method: "DELETE",
    headers: headersFor(options),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete existing asset ${assetId}: GitHub API returned ${response.status}.`);
  }
}

/** uploadUrl is the release's own upload_url (a URI template - stripUploadUrlTemplate below strips the {?name,label} part). */
export function stripUploadUrlTemplate(uploadUrl: string): string {
  return uploadUrl.replace(/\{[^}]*\}$/, "");
}

export async function uploadAsset(
  options: GitHubApiOptions,
  uploadUrl: string,
  assetName: string,
  content: Buffer,
  contentType: string,
): Promise<GitHubReleaseAsset> {
  const fetchFn = options.fetchFn ?? fetch;
  const url = `${stripUploadUrlTemplate(uploadUrl)}?name=${encodeURIComponent(assetName)}`;

  const response = await fetchFn(url, {
    method: "POST",
    headers: headersFor(options, {
      "Content-Type": contentType,
      "Content-Length": String(content.byteLength),
    }),
    body: content,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload asset "${assetName}": GitHub API returned ${response.status}. ${text}`);
  }
  return (await response.json()) as GitHubReleaseAsset;
}
