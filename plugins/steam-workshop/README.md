# @game-ci/steam-workshop (draft)

Steam Workshop / mod-publishing plugin. **Not functional yet** - structural
skeleton only. Mirrors `@game-ci/steam-deploy`'s `deploy <target>` dispatch
shape, so it reuses core's existing `deploy` command registration rather
than needing a new one.

## Why this, distinct from steam-deploy

`@game-ci/steam-deploy` uploads a full game build via `appbuild.vdf`. This
uploads a Workshop _item_ (a mod, map, or asset pack) via SteamCMD's
separate `workshop_build_item.vdf` format and `+workshop_build_item`
command - a genuinely different upload target and VDF schema, not a
variation of the same thing. Real demand: any Workshop-integrated game
currently has zero game-ci coverage for this.

## What's real vs. TODO

- Plugin/command registration shape: real, mirrors `steam-deploy`.
- `execute()`: throws immediately, pointing here.

## Remaining work before this is real

1. Verify the exact `workshop_build_item.vdf` schema (`appid`,
   `contentfolder`, `previewfile`, `vdfpath`/`publishedfileid` for
   updates vs. new items, `visibility`) against real SteamCMD Workshop
   docs/behavior.
2. Handle the new-item vs. update-existing-item distinction - a new item
   has no `publishedfileid` yet and one needs to be captured from
   SteamCMD's output and surfaced as a command output (the same way
   `steam-deploy` captures `steam_build_id`).
3. Reuse `@game-ci/steam-deploy`'s SteamCMD local/Docker execution and
   output-parsing infrastructure rather than duplicating it, if a shared
   `@game-ci/steam-shared` package ends up making sense once both exist.
4. Tests once the above is real.
