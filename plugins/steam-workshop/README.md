> **EXPERIMENTAL.** Functional, but not published to npm and never loaded
> unless you pass `--plugin @game-ci/steam-workshop` explicitly.

# @game-ci/steam-workshop

`game-ci deploy steam-workshop <itemPath> --appId` uploads a Steam
Workshop item (a mod, map, or asset pack) via SteamCMD's
`workshop_build_item.vdf` path and `+workshop_build_item` command - a
genuinely different upload target and VDF schema from
`@game-ci/steam-deploy`'s full-game `appbuild.vdf`.

## Usage

```bash
STEAM_USERNAME=... STEAM_PASSWORD=... game-ci \
  --plugin @game-ci/steam-workshop \
  deploy steam-workshop ./my-mod --appId 480 --title "My Mod"
```

`itemPath` is the item's own content directory - the generated VDF is
written into it directly and `contentfolder` points at it.

- Omit `--publishedFileId` to publish a **new** item; SteamCMD assigns
  the id during upload and it's captured from the tool's own output
  (there's no other way to learn it) and printed on success.
- Pass `--publishedFileId` to **update** an existing item instead.
- Success is trusted from a `PublishedFileId` line in SteamCMD's own
  output, not exit code alone - SteamCMD can exit 0 without actually
  uploading anything, so an exit-0-but-no-id result is still reported as
  a failure (see `parse-workshop-output.ts`).

## Options

| Option              | Description                                                      |
| -------------------- | -------------------------------------------------------------- |
| `--appId`            | Steam App ID the item belongs to. Required.                    |
| `--publishedFileId`  | Existing item id to update. Omit to publish a new item.        |
| `--title`            | Item title.                                                     |
| `--description`      | Item description.                                               |
| `--changeNote`       | Shown in the item's update history on the Workshop page.       |
| `--visibility`       | `0` public, `1` friends-only, `2` private, `3` unlisted. Default `0`. |
| `--previewImage`     | Path (relative to `itemPath`) to a preview image.               |
| `--mode`             | `auto` (default), `local`, or `docker`.                         |
| `--steamCmdPath`     | Explicit path to the steamcmd executable.                       |

Credentials are read from `$STEAM_USERNAME`/`$STEAM_PASSWORD` only, never
CLI arguments - matches `steam-deploy`'s credential handling. TOTP and
`configVdf`-based auth (which `steam-deploy` supports) aren't wired up
here yet.

## Relationship to steam-deploy

This duplicates `steam-deploy`'s local/Docker SteamCMD execution shape
rather than sharing it - `SteamCmdRunner` is hardcoded to the
`appbuild.vdf`/`+run_app_build` flow. Extracting a shared base package
once both packages' real usage patterns are settled is a reasonable
follow-up, not attempted here.
