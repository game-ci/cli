> **EXPERIMENTAL — NOT IMPLEMENTED.** This is a structural draft only: the plugin
> shape is real, but its domain logic is not written. Any command it claims will
> throw. It is not published to npm and is never loaded unless you pass
> `--plugin @game-ci/save-data-compat` explicitly.

# @game-ci/save-data-compat (draft)

Verifies new builds can still load a maintained corpus of historical save
files without crashing or losing data. **Not functional yet**, and
`test-save-compat` is not yet registered anywhere in core's CLI.

## Why this, distinct from the Runtime Test Framework

A specific, well-scoped test type: data compatibility/migration across
versions, not general gameplay-logic correctness.

## Remaining work before this is real

1. Add `test-save-compat <buildPath>` to core's `CliCommands`.
2. Corpus management: where do historical save files live, how do new
   ones get added over time, how large can this reasonably grow before it
   needs its own storage strategy (likely Git LFS or an external bucket,
   not committed directly).
3. Load-and-verify harness - likely shares infrastructure with the
   Runtime Test Framework's in-game hook mechanism once that exists.
4. Tests once the above is real.
