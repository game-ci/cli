# @game-ci/crash-symbol-upload (draft)

Uploads platform-specific debug symbols (dSYM, PDB, breakpad `.sym`) to a
crash-reporting service post-build, so production crash stack traces can
be symbolicated. **Not functional yet**, and its `upload-symbols` command
is not yet registered anywhere in core's CLI - a follow-up core PR is
needed before this can be invoked at all, even once the logic is real.

## Remaining work before this is real

1. Add `upload-symbols <buildPath>` to core's `CliCommands` (see how
   game-ci/cli#123 added `deploy` for the precedent/gotchas - yargs
   positional-vs-`_` handling in particular).
2. Symbol-format detection per platform (dSYM on macOS/iOS, PDB on
   Windows, breakpad `.sym` elsewhere) and the actual upload API for at
   least one real service (Sentry's CLI/API is the most likely first
   target - it's well-documented and has an existing `sentry-cli`
   reference implementation to verify against).
3. Auth token via environment variable only, matching steam-deploy's
   credential convention.
4. Tests once the above is real.
