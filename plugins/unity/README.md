# unity-engine-core

Unity build/test/activation implementation logic, invoked by [`game-ci/cli`](https://github.com/game-ci/cli) and (eventually) by the thin-wrapper action repos (`unity-builder`, `unity-test-runner`, `unity-activate`).

## Why this repo exists

Part of the modernization effort tracked in [game-ci/roadmap#11](https://github.com/game-ci/roadmap/issues/11) (workstream 2, "Option A"). The goal: the popular action repos (`unity-builder`, `unity-test-runner`, `unity-activate`) become thin wrappers around `game-ci/cli`, while `game-ci/cli` itself stays small and fast-moving rather than accumulating engine-specific build logic. This repo is where that logic actually lives, so it has one home instead of being duplicated across each action repo or bloating the CLI.

## Status: early pilot, not yet wired up

**This repo currently contains only the extracted `unity-activate` implementation** (`src/unity-activate/`) — the smallest of the three action repos (1 input, 0 outputs, ~470 LOC), chosen as the pilot per the roadmap issue's recommendation, to validate the pattern with minimal blast radius before tackling `unity-test-runner`'s Checks-API complexity or `unity-builder`'s size and native-macOS build path.

**Not yet done:**
- `unity-activate`'s own `action.yml` has not yet been changed to a thin wrapper — it still runs its own bundled `dist/index.js` today. This repo is not yet consumed by anything.
- The CLI-to-destination invocation mechanism is still an open decision (see roadmap#11 workstream 2): in-process npm dependency, subprocess shell-out, or the existing `cli-protocol-plugin.ts`/CLI-provider-protocol pattern. `src/unity-activate/index.ts`'s `run()` is exported (supporting in-process invocation) while still auto-running when executed directly (supporting subprocess invocation), so either option stays viable until that decision is made.
- `unity-builder`/`unity-test-runner` extraction, including the confirmed shared logic between them (`platform.ts`, `image-tag.ts`, `image-environment-factory.ts` — see roadmap#11 workstream 2's shared-logic analysis) has not started.

## Structure

```
src/
  unity-activate/    # extracted from game-ci/unity-activate, unchanged apart from
                      # index.ts's run() export (see above)
```

Future engine-logic extractions will live alongside this as sibling directories (e.g. `src/unity-builder/`, `src/unity-test-runner/`) once the invocation mechanism is decided.
