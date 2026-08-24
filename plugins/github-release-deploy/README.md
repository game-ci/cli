# @game-ci/github-release-deploy (draft)

GitHub/GitLab Release deploy plugin. **Not functional yet** - structural
skeleton only. Mirrors `@game-ci/steam-deploy`'s `deploy <target>`
dispatch shape, reusing core's existing `deploy` command registration.

## Why this

Fills a real gap: games not on Steam or itch (open-source games, internal
builds, anything distributed straight from a repo) have no deploy target
today. Flagged as the thinnest of the recent plugin-idea batch - closest
in spirit to what a generic release-upload action already does - but
still worth having as a first-party, game-artifact-aware option.

## What's real vs. TODO

- Plugin/command registration shape: real, mirrors `steam-deploy`.
- `execute()`: throws immediately, pointing here.

## Remaining work before this is real

1. Decide GitHub vs. GitLab scope for the first version (likely GitHub
   first, given this repo's own hosting) and the auth token convention
   (env var only, matching `steam-deploy`'s credential handling - never
   CLI args).
2. Multi-platform artifact naming/packaging - if `buildPath` contains
   builds for multiple `targetPlatform`s, decide whether this plugin
   zips each separately with a platform-suffixed name, or expects to be
   invoked once per platform.
3. Release creation vs. update-existing-release handling (idempotent
   re-runs on the same tag).
4. Tests once the above is real.
