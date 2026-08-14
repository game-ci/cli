# The plugin interface, and where the engine boundary actually is

This is the cross-cutting document — the one that had no home while `cli`,
`unity-engine-core`, and `orchestrator` lived in separate repos, because it
describes the *relationship* between them rather than any one of them.

## The contract

`GameCIPlugin` (`src/plugin/plugin-interface.ts`) is what an engine or
provider implements. Plugins reach the registry three ways:

1. **Built-in** — registered in `src/cli.ts` (`unity`, `godot`, `unreal`).
2. **Runtime, in-process** — `--plugin @scope/pkg`, `--plugin ./local/path`,
   `--plugin github:owner/repo`, loaded by `PluginLoader`.
3. **Runtime, out-of-process** — `--plugin executable:/path/to/bin`, over the
   CLI provider protocol.

## Known gap: the contract is duck-typed, not shared

`@game-ci/orchestrator` implements `GameCIPlugin` **structurally**. It does
not import the type — `plugins/orchestrator/src/cli-plugin/index.ts`
references `@game-ci/cli` only in comments. Nothing fails if the interface
changes underneath it.

That was invisible while the two lived in separate repos with no integration
test between them. Now that they're co-located, the fix is cheap and should
follow: export the interface type, have orchestrator import it, and add a
conformance test that loads the plugin through the **public** path
(`PluginLoader`), not a direct import — so the test proves what a third-party
plugin would actually experience.

## Two Unity implementations exist, and neither imports the other

`plugins/unity/` (formerly the separate `unity-engine-core` repo) and
`src/plugin/builtin/unity-plugin.ts` (the CLI's actual, built-in Unity
plugin) are both real, both maintained, and **zero files in either import
from the other.** This isn't new — it predates the monorepo consolidation
(see [cli#69](https://github.com/game-ci/cli/issues/69)) — but bringing
`plugins/unity/` in-repo makes the duplication visible in a way a separate
repo didn't. Landing it here doesn't wire it in; that's the extraction work
below.

## The Unity boundary does not exist yet (in `src/`)

The stated architecture is "CLI is an engine-agnostic dispatcher; Unity is
one plugin among peers." `src/` does not currently match that. Five
non-test files in the core import `src/logic/unity/` and `src/model/unity/`
directly:

| File | Imports | Why it's there |
| --- | --- | --- |
| `src/model/docker.ts` | `UnityEnvironment` | Needs Unity's Docker env vars |
| `src/model/mac-builder.ts` | `UnityEnvironment` | Same, for native macOS builds |
| `src/model/index.ts` | `CacheValidation`, `RunnerImageTag` | Re-exports Unity types from the core barrel |
| `src/command/activate/activate-command.ts` | `PlatformSetup`, `PlatformValidation` | Unity-only command living in core |

Plus soft coupling — `options.engine === 'unity'` string checks in
`docker.ts`, `mac-builder.ts`, `engine.ts`, `recipe-file.ts`.

So Unity is not a module that happens to live here. It is **wired into the
dispatcher**. Extracting it is a decoupling refactor, not a file move.

## Sequenced plan for the Unity extraction

Deliberately *not* done in the same change that established the monorepo —
the two have very different risk profiles.

1. **Add an environment hook to the plugin interface.** Something like
   `engineEnvironment?(options): DockerParameter[]`. `docker.ts` and
   `mac-builder.ts` then ask the registry for the active engine's env vars
   instead of importing `UnityEnvironment`. This removes 2 of the 4 imports
   and is independently valuable — Godot and Unreal currently have no way to
   contribute env vars at all.
2. **Stop re-exporting Unity types from `src/model/index.ts`.** Import sites
   move to the Unity module directly. Mechanical, low risk.
3. **Move `activate` into the Unity plugin's command set.** It is a Unity
   licensing command; it should not sit in core.
4. **Reconcile `src/logic/unity/` + `src/model/unity/` with the already-landed
   `plugins/unity/`** into one implementation, and wire the result into
   `src/plugin/builtin/unity-plugin.ts`. Only worth doing *after* 1–3 - until
   then the dependency graph makes core and Unity mutually dependent, and
   this step also needs a decision on which implementation wins where they
   disagree (`plugins/unity/`'s test suite is more extensive; `src/`'s is
   the one actually shipping today).

Steps 1–3 are worth doing regardless of whether step 4 ever happens: they
make the engine-agnostic claim true in code, not just in the README.

## Related

- [cli#69](https://github.com/game-ci/cli/issues/69) — `unity-engine-core` is
  unreferenced and divergent from this repo's Unity implementation; retire it
  rather than merging two implementations.
- [cli#73](https://github.com/game-ci/cli/issues/73) — compiled-binary asset
  path resolution.
- [cli#75](https://github.com/game-ci/cli/issues/75) — `buildMethod` sentinel;
  an example of core/Unity coupling causing a silent production failure.
