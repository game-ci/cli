# Unreal Engine CI Strategy

## Why we mock Unreal Engine in CI

Real Unreal Engine Docker images are too large for GitHub-hosted runners. This document explains the constraints and our approach.

## Container image sizes

| Image                                                                              | Size               | Can build? | Notes                           |
| ---------------------------------------------------------------------------------- | ------------------ | ---------- | ------------------------------- |
| `ghcr.io/epicgames/unreal-engine:dev-slim-5.4`                                     | ~35GB              | Yes        | Requires Epic GitHub org access |
| Community UE5 images ([ue5-docker](https://github.com/evoverses/ue5-docker), etc.) | ~40GB (from 120GB) | Yes        | Self-built from your UE license |
| Aggressively stripped custom image                                                 | ~40GB floor        | Yes        | Requires manual optimization    |
| Full UE dev image                                                                  | 50-120GB           | Yes        | Way too large                   |

## GitHub runner disk constraints

- **Default free space**: ~22GB on `ubuntu-latest` (x64)
- **With [free-disk-space](https://github.com/jlumbroso/free-disk-space)**: ~52GB (reclaims ~31GB in ~3 min)
- **Paid larger runners**: Up to 150GB (GitHub Teams/Enterprise)

Even the smallest UE build image (~35GB) exceeds the default 22GB. With disk reclamation you get ~52GB — technically enough, but very tight after accounting for the project, build artifacts, and Docker layer overhead. Pull time alone would be 10-20+ minutes.

## Our approach: Mock UE Runtime

Instead of requiring a real UE image, we maintain a **mock Unreal Engine runtime** that faithfully replicates the real UE build tool interfaces:

### What the mock provides

- **`RunUAT.sh`** — Full argument parsing matching real [AutomationTool](https://ikrima.dev/ue4guide/build-guide/ubt/automationtool-exe-unrealbuildtool-exe-reference/) CLI
  - All `BuildCookRun` flags: `-build`, `-cook`, `-stage`, `-pak`, `-archive`, `-package`
  - Project validation from `.uproject` files
  - Correct exit code format: `AutomationTool exiting with ExitCode=0 (Success)`
  - Log output matching real UE format with timestamps

- **`UnrealBuildTool`** — Compiler driver mock

- **Directory structure** matching real UE layout:

  ```
  /home/ue4/UnrealEngine/
  ├── Engine/
  │   ├── Build/
  │   │   ├── BatchFiles/RunUAT.sh
  │   │   └── Build.version
  │   ├── Binaries/Linux/UnrealBuildTool
  │   ├── Content/
  │   ├── Programs/AutomationTool/Saved/Logs/
  │   └── Saved/
  ```

- **Build output structure** matching real UE:
  ```
  <ProjectDir>/
  ├── Binaries/<Platform>/<ProjectName>       # Mock binary + .target receipt
  ├── Intermediate/Build/<Platform>/          # Build intermediates
  ├── Saved/
  │   ├── Cooked/<Platform>/                  # Cooked assets + registry
  │   ├── Paks/<Platform>/                    # .pak files
  │   └── StagedBuilds/<Platform>/            # Staged output + manifest
  └── <ArchiveDir>/
      └── build-manifest.json                 # CI verification artifact
  ```

### Build pipeline steps

The mock executes the same pipeline as real UE:

1. **Build** — Creates mock binary and `.target` build receipt in `Binaries/`
2. **Cook** — Creates mock cooked assets and `CookedAssetRegistry.json` in `Saved/Cooked/`
3. **Pak** — Creates mock `.pak` file in `Saved/Paks/`
4. **Stage** — Copies build + pak to `Saved/StagedBuilds/` with manifest
5. **Archive** — Copies staged build to archive directory with `build-manifest.json`

### Keeping the mock accurate

The mock is designed to be corrected as drift is discovered:

1. If a user reports that real UE behaves differently from our mock, we update the mock
2. Each correction is tracked as a GitHub issue with the `mock-drift` label
3. The mock's accuracy improves over time through real-world usage reports

### When you need a real UE image

For actual UE compilation and content cooking, use one of:

1. **Manual workflow_dispatch**: The `engine-smoke-test.yml` workflow accepts a `unreal-image` input
2. **Larger runners**: GitHub offers 150GB runners on paid plans
3. **Self-hosted runners**: With sufficient disk space (100GB+)
4. **Local testing**: Pull a UE image to your dev machine

## References

- [Slim down UE5 Docker images](https://edwardbeazer.com/posts/slim-down-unreal-engine-5-docker-build-images/) — Reducing from 120GB to 40GB
- [Community UE5 container images](https://unrealcontainers.com/docs/obtaining-images) — Overview of available images
- [Official UE Container Images](https://unrealcontainers.com/docs/obtaining-images/official-images) — Epic's official images
- [GitHub runner disk space](https://github.com/actions/runner-images/discussions/9329) — Runner storage constraints
- [free-disk-space action](https://github.com/jlumbroso/free-disk-space) — Reclaim runner disk space
- [AutomationTool reference](https://ikrima.dev/ue4guide/build-guide/ubt/automationtool-exe-unrealbuildtool-exe-reference/) — RunUAT CLI docs
