# @game-ci/runtime-test-framework

GPU-free, assertion-based tests run against the actual _built player_, not
the Editor, and not Unity's own Test Framework's specialized test player.
Loaded in core's default plugin list, the same way `steam-deploy` is.

## Why this, distinct from `game-ci test`

`game-ci test`'s `-runTests` path (Docker or local) runs Unity's own
official Test Framework - editmode/playmode/standalone-_test-mode_
assemblies, executed by a specialized test player Unity's own tooling
builds. It never exercises your project's real shipped build.

`game-ci test-runtime` launches the actual player executable your build
step produced, and reports on whatever tests its own in-game harness ran:
real assertions against real runtime behavior, on the real artifact a
player would download and run.

## Usage

```bash
game-ci test-runtime ./build/StandaloneLinux64 --timeout 60000
```

`buildPath` can point directly at the executable, or at a directory
containing it (the plugin looks for the single matching candidate:
one `.exe` on Windows, one `.app` bundle on macOS, or one executable-bit
file on Linux - it errors with a clear message if it finds none or more
than one, rather than guessing).

## The results contract

This plugin never runs test code itself - a game project's own in-game
test harness does. The contract between them:

1. The plugin launches the player with two environment variables set:
   `GAME_CI_RUNTIME_TEST_MODE=1` and `GAME_CI_RUNTIME_TEST_RESULTS_PATH=<path>`.
2. The in-game harness (code you write in your project, not part of this
   plugin) checks for `GAME_CI_RUNTIME_TEST_MODE`, runs whatever tests it
   wants, and writes a JSON file to `GAME_CI_RUNTIME_TEST_RESULTS_PATH`
   before the process exits:

   ```json
   {
     "schemaVersion": 1,
     "tests": [
       { "name": "player spawns at origin", "passed": true, "durationMs": 12 },
       {
         "name": "inventory persists across scene load",
         "passed": false,
         "message": "expected 3 items, got 2"
       }
     ]
   }
   ```

3. The plugin reads that file after the process exits (or kills it and
   fails the run if it doesn't exit within `--timeout`), and fails the CI
   step if any test reports `passed: false` - or if the file was never
   written at all, which usually means the harness isn't wired up.

The results file, not the process exit code, is authoritative: a player
that writes valid results but happens to exit non-zero for an unrelated
reason still has its real test results honored.

## What's implemented

- `resolvePlayerExecutable` - per-platform executable discovery (Windows
  `.exe`, macOS `.app` bundle, Linux executable-bit file), with tests.
- `launchAndCollectResults` - process launch, environment variable
  contract, timeout/kill handling, stale-results-file cleanup before
  each run, with tests using an injected fake `spawn`.
- `parseRuntimeTestResults` / `summarizeRuntimeTestResults` - schema
  validation and pass/fail summarization, with tests.
- `test-runtime [buildPath]` registered as a core CLI command
  (`CliCommands`/`CommandFactory`), bypassing engine detection the same
  way `deploy` does - a built player carries no Unity/Godot/Unreal
  project markers of its own.

## What's not implemented

- No actual in-game harness for any specific engine (Unity, Godot,
  Unreal) is provided - that's necessarily project-specific code a game
  team writes against the results contract above, not something this CLI
  plugin can ship generically.
- No test filtering (`--testFilter`) yet - all tests the harness runs are
  always reported.
