# @game-ci/runtime-test-framework (draft)

GPU-free, assertion-based tests run against the actual _built player_, not
the Editor. **Not functional yet**, and `test-runtime` is not yet
registered anywhere in core's CLI.

## Why this, distinct from a shallow smoke test

Unity's own Test Runner only ever tests Editor-time code - it never
exercises a real built binary. A shallow "does it boot" check catches
crashes but nothing about actual behavior. This is the deeper version:
real assertions, real pass/fail reporting, against the shipped artifact.

## Remaining work before this is real

1. Add `test-runtime <buildPath>` to core's `CliCommands`.
2. Define the actual test-authoring contract: how does a game project
   declare runtime tests the built player will run and report on? (Likely
   some in-game harness the player links against, driven by a
   command-line flag/env var this plugin sets, that writes a
   machine-readable result file this plugin then reads.)
3. Headless/GPU-free launch strategy per platform (this is the part that
   most needs real engine-specific research - a Unity player, for
   instance, needs `-batchmode -nographics` equivalents).
4. Tests once the above is real.
