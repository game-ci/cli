> **EXPERIMENTAL — NOT IMPLEMENTED.** This is a structural draft only: the plugin
> shape is real, but its domain logic is not written. Any command it claims will
> throw. It is not published to npm and is never loaded unless you pass
> `--plugin @game-ci/itch-deploy` explicitly.

# @game-ci/itch-deploy (draft)

itch.io deploy plugin. **Not functional yet** - structural skeleton only.
Mirrors `@game-ci/steam-deploy`'s shape: engine-agnostic, dispatched via
the `deploy` command's `'*'` engine wildcard. Not wired into core's
default load list.

## Why itch.io

Huge game-jam/indie audience, currently all ad hoc third-party GitHub
Actions. itch.io's official `butler` CLI is straightforward, so this
should be one of the faster ones to bring to real functionality once
someone picks it up.

## What's real vs. TODO

- Plugin/command registration shape: real, mirrors `steam-deploy`'s
  `deploy <target>` dispatch.
- `execute()`: throws immediately, pointing here.

## Remaining work before this is real

1. Wrap `butler push <buildPath> <user>/<game>:<channel>`, including
   butler's own login/credential handling (an API key, likely via
   `BUTLER_API_KEY` env var, matching steam-deploy's env-var-only
   credential convention - never CLI args).
2. Decide how `game-ci deploy itch` needs core's `deploy <target>
[buildPath]` yargs registration extended, if at all (steam-deploy
   already required a core change here - see game-ci/cli#123 - itch may
   reuse it as-is once its own options are registered via
   `configureOptions`).
3. Tests mirroring `steam-deploy`'s `parse-steamcmd-output.test.ts` and
   `vdf-generator.test.ts` pattern - butler's own output has a similar
   "did this actually succeed" ambiguity worth checking.
