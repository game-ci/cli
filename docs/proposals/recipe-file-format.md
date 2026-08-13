# Recipe file for `build-unity-image`

**Status: implemented.** See game-ci/roadmap#11 (workstream 4).

`build-unity-image` (`src/command/build-image/build-image-command.ts`) already did most of the
"pre-built-image-free path" work — a real, working `--unity-version`/`--modules`/`--base-os` CLI
command that generates a Dockerfile and builds it locally. What it didn't have was a **checked-in,
diffable artifact**: the "recipe" only existed as whatever flags you happened to type, not
something you could commit to your repo, code-review, or diff between versions. `--recipe` adds
that.

## Schema

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

Only `unityVersion` is required. `engine`, if present, must be `unity` (the only engine
`build-unity-image` supports today).

## Usage

```bash
game-ci build-unity-image --recipe game-ci-recipe.yml

# equivalent, flags-only form (still fully supported):
game-ci build-unity-image ubuntu android,webgl --unity-version 2022.3.20f1
```

## Resolved design questions

1. **Is this actually wanted?** Implemented as an additive, opt-in flag — `--recipe` is optional,
   the existing CLI-flags interface is completely unchanged and still the primary path. Low cost
   either way; easy to remove if it turns out nobody wants it.
2. **`engine: unity` field** — kept, validated (rejects anything other than `unity` or absent),
   forward-compatible with a future multi-engine recipe format without needing a breaking change.
3. **Does this replace the CLI flags, or layer on top?** Layers on top, and **recipe fields take
   priority over CLI flags** for the same setting when both are given. Rationale: the recipe file
   is explicitly the "commit it, diff it" source of truth per its own premise — if a flag silently
   won over the file you just committed and code-reviewed, that would undermine the entire point of
   having a checked-in recipe. `--push` is the one exception (a per-invocation action, not a recipe
   property, so it's always a flag). Fields the recipe doesn't declare still fall through to
   CLI flags / built-in defaults, so partial recipes (e.g. no `tag`) work as expected.
4. **Unity CLI integration** (workstream 3) — not addressed here; still an open question for
   whenever `build-unity-image`'s Dockerfile generator gains a Unity-CLI-based install path.

## Implementation notes

- `src/model/build-image/recipe-file.ts` — `RecipeFileReader.read()` parses and validates a recipe
  file, throwing `RecipeFileError` (not a raw YAML parse error) on any problem: missing file,
  malformed YAML, missing `unityVersion`, wrong `engine`, or `modules` not being a list.
- Found and fixed a real, pre-existing bug in `build-image-command.ts` while wiring this in: it
  called `System.run()` with the wrong argument shape (passing an options object where
  `System.run`'s real signature expects an optional `windowsSpecificCommand` string) and read
  fields (`result.stdout`, `.exitCode`) that don't exist on `System`'s actual return type
  (`{status: {success, code}, output, error}`). `System.run` also throws on failure rather than
  resolving with a checkable result — the build/push call sites weren't wrapped in `try`/`catch`,
  so a real Docker failure would have thrown uncaught. All three call sites (changeset resolution,
  build, push) are now fixed and covered by tests.

## Non-goals

- Not addressing the Windows Dockerfile parity gap noted separately in game-ci/roadmap#11.
