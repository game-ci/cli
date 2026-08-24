> **EXPERIMENTAL — NOT IMPLEMENTED.** This is a structural draft only: the plugin
> shape is real, but its domain logic is not written. Any command it claims will
> throw. It is not published to npm and is never loaded unless you pass
> `--plugin @game-ci/rpg-maker` explicitly.

# @game-ci/rpg-maker (draft)

RPG Maker (MV/MZ) engine plugin. **Not functional yet** - structural skeleton
only. Not wired into core's default load list; loadable via
`--plugin @game-ci/rpg-maker` once it's real.

## Why RPG Maker

Large, passionate, completely unserved niche today - no official build CLI
exists (export is a manual Editor step), and the community currently
hand-rolls fragile packaging scripts around NW.js. Real automation pain,
genuinely underserved.

## What's real vs. TODO

- Plugin registration shape: real, follows the same pattern as
  `godot-plugin.ts`.
- Project detection: stubbed, returns `false` unconditionally.
- Build command: throws immediately, pointing here.

## Remaining work before this is real

1. Verify MV vs MZ project detection (data/System.json plus MV's `www/` or
   MZ's `js/` folder) against real project exports from both versions.
2. Work out the actual NW.js packaging steps per target platform - this is
   the fiddliest part, since there's no official CLI to shell out to; the
   plugin likely needs to assemble the NW.js runtime + game data itself.
3. Decide how platform-specific packaging (Windows/Mac/Linux NW.js
   binaries) maps onto `targetPlatform`.
4. Tests once the above is real.
