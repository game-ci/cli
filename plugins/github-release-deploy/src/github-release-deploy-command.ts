import * as fs from "node:fs";
import * as path from "node:path";
import { getReleaseByTag, createRelease, deleteAsset, uploadAsset, type GitHubApiOptions } from "./github-api";

export interface GithubReleaseDeployOptions {
  buildPath?: string;
  repo?: string;
  tag?: string;
  releaseNotes?: string;
  draft?: boolean;
  prerelease?: boolean;
  assetName?: string;
  targetCommitish?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

const CONTENT_TYPES: Record<string, string> = {
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".tgz": "application/gzip",
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export class GithubReleaseDeployCommand {
  public readonly name = "Deploy github release";

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("repo", {
        describe: 'Repository to attach the release to, as "owner/repo". Defaults to $GITHUB_REPOSITORY when running in GitHub Actions.',
        type: "string",
      })
      .option("tag", {
        describe: "Release tag. An existing release for this tag is reused (its assets updated); otherwise a new release is created.",
        type: "string",
        demandOption: true,
      })
      .option("releaseNotes", {
        describe: "Release body/description. Left blank if omitted (GitHub renders an empty body, not a placeholder).",
        type: "string",
      })
      .option("draft", {
        describe: "Create the release as a draft.",
        type: "boolean",
        default: false,
      })
      .option("prerelease", {
        describe: "Mark the release as a prerelease.",
        type: "boolean",
        default: false,
      })
      .option("assetName", {
        describe: "Override the uploaded asset's file name. Only valid when buildPath is a single file.",
        type: "string",
      })
      .option("targetCommitish", {
        describe: "Commit/branch to create the tag from, if it doesn't already exist. Defaults to the repository's default branch.",
        type: "string",
      });
  }

  public async execute(options: GithubReleaseDeployOptions): Promise<boolean> {
    const buildPath = options.buildPath;
    if (!buildPath) {
      throw new Error("A build path is required: game-ci deploy github-release <buildPath>");
    }
    if (!fs.existsSync(buildPath)) {
      throw new Error(`Build path does not exist: ${buildPath}`);
    }

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!token) {
      throw new Error(
        "GITHUB_TOKEN (or GH_TOKEN) must be set as an environment variable (never as a CLI argument - argv can leak through process listings).",
      );
    }

    const repo = options.repo || process.env.GITHUB_REPOSITORY;
    if (!repo) {
      throw new Error("--repo is required (or set $GITHUB_REPOSITORY, as GitHub Actions does automatically).");
    }

    const tag = options.tag!;
    const apiOptions: GitHubApiOptions = { repo, token };

    const files = this.collectFiles(buildPath, options.assetName);
    if (files.length === 0) {
      throw new Error(`No files found to upload at "${buildPath}".`);
    }

    console.log(`Deploying ${files.length} asset(s) from ${buildPath} to ${repo}'s release "${tag}"`);

    let release = await getReleaseByTag(apiOptions, tag);
    if (release) {
      console.log(`Reusing existing release "${tag}" (id ${release.id}).`);
    } else {
      release = await createRelease(apiOptions, {
        tag,
        body: options.releaseNotes,
        draft: options.draft,
        prerelease: options.prerelease,
        targetCommitish: options.targetCommitish,
      });
      console.log(`Created release "${tag}" (id ${release.id}).`);
    }

    for (const file of files) {
      const existing = release.assets.find((asset) => asset.name === file.assetName);
      if (existing) {
        // Re-uploading with the same name is rejected outright by GitHub's
        // API (422 "already_exists") - delete first so re-running this
        // command against the same tag (e.g. a retried CI job) is
        // idempotent rather than a hard failure.
        console.log(`Replacing existing asset "${file.assetName}".`);
        await deleteAsset(apiOptions, existing.id);
      }

      const content = fs.readFileSync(file.absolutePath);
      await uploadAsset(apiOptions, release.upload_url, file.assetName, content, contentTypeFor(file.absolutePath));
      console.log(`Uploaded "${file.assetName}" (${content.byteLength} bytes).`);
    }

    console.log(`Release deployment succeeded: ${release.html_url}`);
    return true;
  }

  /**
   * buildPath may be a single file (uploaded as-is, optionally renamed via
   * --assetName) or a directory (every top-level regular file inside it is
   * uploaded as a separate asset, named after itself - not recursive, so
   * naming stays predictable and matches how a build step typically lays
   * out one file per platform/artifact rather than nested folders).
   */
  private collectFiles(buildPath: string, assetNameOverride?: string): Array<{ absolutePath: string; assetName: string }> {
    const absoluteBuildPath = path.resolve(buildPath);
    const stat = fs.statSync(absoluteBuildPath);

    if (stat.isFile()) {
      return [{ absolutePath: absoluteBuildPath, assetName: assetNameOverride || path.basename(absoluteBuildPath) }];
    }

    if (assetNameOverride) {
      throw new Error("--assetName is only valid when buildPath is a single file, not a directory.");
    }

    return fs
      .readdirSync(absoluteBuildPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        absolutePath: path.join(absoluteBuildPath, entry.name),
        assetName: entry.name,
      }));
  }
}
