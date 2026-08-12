# Proposal: declarative recipe file for `build-unity-image` (draft, not decided)

Status: **proposal only** — not implemented, not decided. See game-ci/roadmap#11 (workstream 4):
> "confirm with the maintainer whether a declarative recipe-file format on top of the existing
> command is actually wanted (vs. the CLI-flags interface being sufficient)"

This document exists so that question has something concrete to react to, not to pre-empt the
answer. If the answer is "the CLI flags are sufficient," this proposal should be closed, not
merged.

## Why this might be wanted

`build-unity-image` (`src/command/build-image/build-image-command.ts`) already does most of the
"pre-built-image-free path" work — it's a real, working, `--unity-version`/`--modules`/`--base-os`
CLI command that generates a Dockerfile and builds it locally. What it doesn't have is a
**checked-in, diffable artifact**: today the "recipe" only exists as whatever flags you happen to
type, not as something you can commit to your repo, code-review, or diff between versions.

## Strawman schema

```yaml
# game-ci-recipe.yml
version: 1
engine: unity
unityVersion: 2022.3.20f1
baseOs: ubuntu
modules:
  - android
  - webgl
# optional overrides, mirroring build-unity-image's existing flags 1:1
changeset: null # auto-resolved if omitted, same as today
hubImage: null # defaults to unityci/hub(:windows-latest)
baseImage: null # defaults to unityci/base(:windows-latest)
tag: null # defaults to unityci/editor:<baseOs>-<unityVersion>-<modules>
```

Usage (strawman):

```bash
game-ci build-unity-image --recipe game-ci-recipe.yml
# equivalent to today's:
game-ci build-unity-image ubuntu android,webgl --unity-version 2022.3.20f1
```

## Open questions (deliberately unresolved here)

1. **Is this actually wanted?** The CLI-flags interface already works and is simple. A recipe file
   adds a second way to express the same thing — worth confirming there's a real "I want to commit
   this and diff it" use case before adding the surface.
2. **`engine: unity` field** — included above on the assumption this eventually generalizes past
   Unity (ties into workstream 3's multi-engine work), but `build-unity-image` itself is Unity-only
   today. Should this file format be Unity-specific for now, or designed multi-engine from the
   start even though only one engine is implemented?
3. **Does this replace the CLI flags, or layer on top?** The strawman above treats `--recipe` as an
   alternative to the existing flags (matching the same fields), not a replacement — flags still
   work for one-off/CI-generated builds, the recipe file is for the "commit it to the repo" case.
4. **Unity CLI integration** (workstream 3) — once `build-unity-image`'s Dockerfile generator can
   use Unity CLI's Hub-free install instead of `unity-hub`, does the recipe format need an
   `installer: hub | unity-cli` field, or is that an implementation detail the recipe shouldn't
   need to know about?

## Non-goals of this document

- Not proposing any code changes yet.
- Not proposing this replaces `build-unity-image`'s existing flags.
- Not addressing the Windows Dockerfile parity gap noted separately in game-ci/roadmap#11.
