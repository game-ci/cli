> **EXPERIMENTAL — NOT IMPLEMENTED.** A structural draft only: `capture` is not registered
> anywhere in core's CLI, and any command this plugin claims will throw. Not published to
> npm, and never loaded unless you pass `--plugin @game-ci/screen-capture` explicitly.

# @game-ci/screen-capture (draft, GPU-required)

Baseline-vs-current frame diffing and QA evidence capture. Requires a GPU-capable runner -
unlike most plugins in this batch.

## What's real

`visual-baseline.ts`'s comparison logic is real and tested: `digestDirectory` content-hashes
every image under a directory, and `compareVisualCaptures` diffs one digest map against
another. Deliberately **not** perceptual/threshold diffing - a one-pixel antialiasing change
and a completely different frame both read as "changed". Perceptual diffing needs a real
image codec and a tuned threshold; pretending to do it with a byte hash would be worse than
not offering one. An empty baseline is reported as unverified (every capture is "added"),
not as a pass - a run with nothing to compare against has not actually been verified.

## Why this, distinct from marketing screenshots

Deliberately separate concern from a store-screenshot/marketing-asset plugin: this is about
catching visual regressions with orphan-process cleanup and baseline comparison, not
generating polished store assets.

## Remaining work before `capture` is real

1. Add `capture <buildPath>` to core's `CliCommands`.
2. Define capture checkpoints - how does a game project mark "capture a frame here" (likely
   an in-game hook similar to `runtime-test-framework`'s harness)?
3. Orphaned-capture-process cleanup for killed/crashed runs.
4. A real perceptual diff mode, if wanted - the current digest comparison is exact-match
   only, deliberately, per the above.
