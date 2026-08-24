# @game-ci/gamemaker (draft)

GameMaker Studio engine plugin. **Not functional yet** - this is a structural
skeleton: a real, correctly-typed `GameCIPlugin` conforming to game-ci/cli's
plugin interface, registered the same way any other plugin is (dynamically,
via `PluginLoader.load('@game-ci/gamemaker')` or `--plugin @game-ci/gamemaker`

- it is deliberately **not** wired into core's default load list, unlike
  `orchestrator` and `steam-deploy`, since its build logic doesn't work yet).

## Why GameMaker

Large, underserved indie audience. GameMaker ships an official CLI (`Igor`)
that the Editor itself calls for builds - this plugin wraps that, the same
way `godot-plugin.ts` wraps `godot --headless --export-release`.

## What's real vs. TODO

- Plugin registration shape (engine detector + command dispatch): real,
  follows the exact pattern of `src/plugin/builtin/godot-plugin.ts`.
- Project detection (`*.yyp` file presence): stubbed, returns `false`
  unconditionally.
- Build command: throws immediately, pointing here.

## Remaining work before this is real

1. Verify Igor's actual CLI invocation shape against a real GameMaker
   install - flags for runtime/license selection, target platform, output
   path. Do not guess this; it needs to be checked against real GameMaker
   documentation/behavior, the same way this repo's other engine plugins
   were verified against real source before shipping.
2. Parse the GameMaker/runtime version out of the project for
   `engineVersion` (GameMaker's project format should expose this
   somewhere in the `.yyp` or a sibling options file - needs checking).
3. Decide the Docker story: does Igor need a licensed GameMaker install
   inside a container (like Unreal), or can it run against a
   community-buildable image (like Godot)? This affects whether the
   plugin needs a `--customImage` requirement or ships a default image.
4. Tests mirroring `godot-plugin.test.ts` / the build-command test pattern
   once the above is real.
