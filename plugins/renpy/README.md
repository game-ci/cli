> **EXPERIMENTAL — NOT IMPLEMENTED.** This is a structural draft only: the plugin
> shape is real, but its domain logic is not written. Any command it claims will
> throw. It is not published to npm and is never loaded unless you pass
> `--plugin @game-ci/renpy` explicitly.

# @game-ci/renpy (draft)

Ren'Py engine plugin. **Not functional yet** - structural skeleton only.
Not wired into core's default load list; loadable via `--plugin
@game-ci/renpy` once real.

## Why Ren'Py

Passionate, completely unserved visual-novel niche. Unlike RPG Maker,
Ren'Py does ship a real CLI (`renpy.exe <project> distribute`), so this
should be more tractable than RPG Maker once verified.

## What's real vs. TODO

- Plugin registration shape: real, follows the `godot-plugin.ts` pattern.
- Project detection: stubbed, returns `false` unconditionally.
- Build command: throws immediately, pointing here.

## Remaining work before this is real

1. Verify the exact `renpy.exe <project> distribute` flags and output
   archive structure against a real Ren'Py SDK install.
2. Map Ren'Py's own platform packaging options onto `targetPlatform`.
3. Decide Docker story - is there a viable Ren'Py SDK container image, or
   does this need a `--customImage` requirement like Unreal?
4. Tests once the above is real.
