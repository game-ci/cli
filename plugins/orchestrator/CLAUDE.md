# @game-ci/orchestrator

## Overview

Standalone build orchestration engine for Game CI. Dispatches Unity builds to cloud infrastructure (AWS, Kubernetes, GCP, Azure, etc.) and manages their lifecycle.

Extracted from [game-ci/unity-builder](https://github.com/game-ci/unity-builder) — see PR #819.

## Commands

```bash
yarn install          # Install dependencies
yarn build            # Compile TypeScript (tsc → dist/)
yarn test             # Run all tests (jest)
yarn test:ci          # Run tests single-threaded
yarn format           # Format code with prettier
yarn game-ci --help   # Run CLI locally via ts-node
```

## Architecture

- **Entry point**: `src/index.ts` — package exports (Orchestrator, services, types)
- **CLI**: `src/cli.ts` → `src/cli/commands/` — yargs-based CLI (build, orchestrate, status, activate, version, update)
- **Orchestrator core**: `src/model/orchestrator/orchestrator.ts` — main class, provider setup, build lifecycle
- **Providers**: `src/model/orchestrator/providers/` — one directory per provider (aws/, k8s/, docker/, gcp-cloud-run/, azure-aci/, github-actions/, gitlab-ci/, ansible/, remote-powershell/, cli/)
- **Services**: `src/model/orchestrator/services/` — hooks, cache, hot-runner, lfs, output, reliability, sync, test-workflow, core
- **Input parsing**: `src/model/input-readers/` — reads from GitHub Actions, CLI, or environment
- **Build parameters**: `src/model/build-parameters.ts` — central config object
- **Workflows**: `src/model/orchestrator/workflows/` — workflow composition root

## Key Patterns

- **Provider interface**: all providers implement `ProviderInterface` from `providers/provider-interface.ts`
- **Provider loader**: `providers/provider-loader.ts` selects provider by `providerStrategy` string
- **Container hooks**: composable shell scripts run inside build containers (pre/post build)
- **Middleware pipeline**: trigger-aware hooks in `services/hooks/middleware.ts`
- **Services export lazily**: advanced services (cache, LFS, submodules, git hooks) are exported from `src/index.ts` for unity-builder's plugin interface to consume on-demand
- **@actions/core dependency**: used for logging even outside GitHub Actions (shimmed in CLI mode)

## Testing

- Jest with ts-jest, config in `jest.config.js`
- Test files: `*.test.ts` colocated with source or in `__tests__/` directories
- Test utilities in `src/test-utils/`
- Integration tests exercise real AWS/K8s flows (run in CI with MiniStack + k3d)

## CI Workflows

- `.github/workflows/test.yml` — unit tests
- `.github/workflows/ci.yml` — caller workflow for test + integrity
- `.github/workflows/orchestrator-integrity.yml` — integration tests (AWS via MiniStack, K8s via k3d)
- `.github/workflows/release-cli.yml` — CLI binary releases (npm publish is not yet active — no `NPM_TOKEN` secret configured)

## Conventions

- TypeScript strict mode is off (`strict: false` in tsconfig)
- CommonJS modules (`module: "commonjs"`)
- Prettier for formatting (no ESLint)
- No semicolons enforcement — existing code uses both styles
- Template literals with backticks for string interpolation throughout
- `dist/` is the build output directory (also used by pkg for CLI binaries)

## Related Repositories

- [game-ci/unity-builder](https://github.com/game-ci/unity-builder) — GitHub Action that optionally uses this package
- [game-ci/documentation](https://github.com/game-ci/documentation) — Docusaurus docs site at game.ci
