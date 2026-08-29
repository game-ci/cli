> **EXPERIMENTAL.** Functional, and registered by default in every `game-ci`
> binary (no `--plugin` flag needed) - not published to npm, so it's loaded
> via a literal `import()` compiled directly into the binary instead.

# @game-ci/itch-deploy

`game-ci deploy itch <buildPath> --user --game --channel` wraps itch.io's
official `butler push` CLI. Mirrors `@game-ci/steam-deploy`'s shape:
engine-agnostic, dispatched via the `deploy` command's `'*'` engine
wildcard.

## Usage

```bash
BUTLER_API_KEY=... game-ci deploy itch ./build --user myuser --game mygame --channel windows
```

- Requires `butler` already installed and on `PATH` (or pass
  `--butlerPath` explicitly - recommended for CI determinism). This
  plugin doesn't auto-install or auto-download butler.
- The API key is read from `$BUTLER_API_KEY` only, never a CLI argument -
  butler itself reads this env var and skips its normal interactive
  `butler login` flow, matching `steam-deploy`'s credential handling.
- Success/failure is trusted from butler's own exit code - unlike
  SteamCMD (see `steam-deploy`'s `parse-steamcmd-output.ts`), butler is a
  modern Go CLI with reliable exit-code semantics, so no output-text
  heuristic is needed. A failure's message includes the tail of butler's
  own output for diagnostics.

## Options

| Option          | Description                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| `--user`         | itch.io username or organization. Required.                                 |
| `--game`         | itch.io game slug. Required.                                                 |
| `--channel`      | Channel to push to, e.g. `windows`, `linux`, `web`. Required.               |
| `--butlerPath`   | Explicit path to the butler executable.                                     |
| `--userVersion`  | Custom version string shown in itch.io's build history (butler's `--userversion`). |
| `--ignore`       | Comma-separated glob patterns excluded from the push.                       |

## A note on verification

Butler's `push`/`--userversion`/`--ignore` flag shapes are taken from
itch.io's own public documentation and are stable, long-standing butler
CLI conventions - but this implementation hasn't been run against a live
`butler push` in this session. Verify against a real itch.io project
before depending on it in production; please report back (or send a fix)
if anything doesn't match butler's actual behavior.
