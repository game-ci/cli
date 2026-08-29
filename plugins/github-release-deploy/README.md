> **EXPERIMENTAL.** Functional, and registered by default in every `game-ci`
> binary (no `--plugin` flag needed) - not published to npm, so it's loaded
> via a literal `import()` compiled directly into the binary instead.

# @game-ci/github-release-deploy

`game-ci deploy github-release <buildPath>` attaches built artifacts to a
GitHub Release - a deploy target for games distributed outside
Steam/itch (open-source games, internal builds, anything shipped
straight from a repo). Mirrors `@game-ci/steam-deploy`'s `deploy
<target>` dispatch shape, reusing core's existing `deploy` command
registration.

## Usage

```bash
GITHUB_TOKEN=... game-ci deploy github-release ./build --repo owner/repo --tag v1.2.3
```

- `buildPath` may be a single file (uploaded as-is, optionally renamed
  via `--assetName`) or a directory - every top-level regular file
  inside it is uploaded as a separate asset, named after itself. Not
  recursive, so a build step that produces one artifact per
  platform/target lays out predictably; nested folders are ignored (run
  the command once per platform if you need per-platform releases from a
  build that groups them in subdirectories).
- `--tag` reuses an existing release for that tag if one exists (its
  assets updated), or creates a new one - re-running against the same
  tag (e.g. a retried CI job) is idempotent: an asset that already
  exists on the release is deleted and re-uploaded rather than failing
  with GitHub's `422 already_exists`.
- The token is read from `$GITHUB_TOKEN` (or `$GH_TOKEN`) only, never a
  CLI argument - matches `steam-deploy`'s credential handling.
- `--repo` defaults to `$GITHUB_REPOSITORY`, which GitHub Actions sets
  automatically.

## Options

| Option              | Description                                                                    |
| -------------------- | -------------------------------------------------------------------------------- |
| `--repo`             | `owner/repo`. Defaults to `$GITHUB_REPOSITORY`.                                 |
| `--tag`              | Release tag. Required.                                                          |
| `--releaseNotes`     | Release body/description.                                                       |
| `--draft`            | Create the release as a draft. Default `false`.                                 |
| `--prerelease`       | Mark the release as a prerelease. Default `false`.                              |
| `--assetName`        | Override the uploaded asset's file name. Only valid for a single-file buildPath. |
| `--targetCommitish`  | Commit/branch to create the tag from, if it doesn't already exist.              |

## Scope of this first version

GitLab Release support was scoped out (GitHub first, given this repo's
own hosting) - the command/option shape doesn't preclude adding it later
behind a `--provider` flag without a breaking change.
