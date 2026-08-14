# game-ci — agent guide

Deliberately short. This is a **routing table**, not a manual: find the area
you're working in, then read that area's own `AGENTS.md`. Don't read them all.

## What this repo is

The `game-ci` CLI and the engine plugins that ship with it. The CLI is an
engine-agnostic dispatcher; each engine is a plugin behind a common
interface. GitHub Actions wrappers (`unity-builder`, `unity-test-runner`,
`unity-activate`) live in their own repos **only** because GitHub Actions
requires it — they are ~100-line wrappers that install this CLI and shell
out to it. No logic belongs in them.

## Where things live

| Path | What | Read next |
| --- | --- | --- |
| `src/cli.ts`, `src/cli-commands.ts` | Command registration, option parsing (yargs) | — |
| `src/plugin/` | Plugin interface + registry + loader | `docs/architecture/plugin-interface.md` |
| `src/plugin/builtin/` | Built-in engine plugins (unity, godot, unreal) | — |
| `src/command/` | Command implementations | — |
| `src/command-options/` | Per-command yargs option definitions | — |
| `src/model/` | Docker, system exec, image tags, outputs | — |
| `src/logic/unity/` | Unity-specific logic (licensing, platform setup) | — |
| `dist/platforms/` | In-container build/licensing scripts (bash + PowerShell) | — |
| `dist/default-build-script/` | The C# `UnityBuilderAction` copied into user projects | — |
| `packages/orchestrator/` | Remote/cloud build orchestration, loaded as a CLI plugin | `packages/orchestrator/CLAUDE.md` |

## Conventions that bite

- **Bun, not Node.** `bun test ./src` — note the `./src`. Bare `bun test <arg>`
  treats the argument as a *substring filter*, not a path, so `bun test src`
  also globs `packages/orchestrator`'s vitest suites and fails on a runner
  mismatch. Use `bun run test`.
- **`dist/` is committed and load-bearing.** It is not build output you can
  regenerate — it holds the platform scripts and the C# build script that get
  volume-mounted into Unity containers. `bun run build` overwrites
  `dist/index.js` only.
- **Option defaults can be sentinels.** `buildMethod` must default to `''`,
  not to the built-in class name: the platform scripts only copy the built-in
  build script into the project when `BUILD_METHOD` is empty. See
  [cli#75](https://github.com/game-ci/cli/issues/75) for the outage this caused.
- **Compiled-binary paths differ from dev paths.** Bun's `--compile` virtualises
  `import.meta.url`, so `dependencies.ts` derives `__dirname` from
  `process.execPath` when running as a compiled binary. Static assets must sit
  next to the binary. See [cli#73](https://github.com/game-ci/cli/issues/73).

## Review rules

Unity paths and the release workflow require approval from a second
maintainer — see `.github/CODEOWNERS`. Everything else is intentionally
unowned and self-mergeable. If you're touching Unity, expect a review round.
