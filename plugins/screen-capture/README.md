# @game-ci/screen-capture (draft, GPU-required)

Baseline-vs-current frame diffing and QA evidence capture. **Not
functional yet**, and `capture` is not yet registered anywhere in core's
CLI. Requires a GPU-capable runner - unlike most plugins in this batch.

## Why this, distinct from marketing screenshots

Deliberately separate concern from a store-screenshot/marketing-asset
plugin: this is about catching visual regressions with orphan-process
cleanup and baseline comparison, not generating polished store assets.

## Remaining work before this is real

1. Add `capture <buildPath>` to core's `CliCommands`.
2. Define capture checkpoints - how does a game project mark "capture a
   frame here" (likely an in-game hook similar to
   runtime-test-framework's harness)?
3. Baseline storage/diffing strategy (perceptual diff threshold, not
   exact-pixel-match, to tolerate benign renderer/driver noise).
4. Orphaned-capture-process cleanup for killed/crashed runs.
5. Tests once the above is real.
