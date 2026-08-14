# @game-ci/orchestrator

Workflow orchestration engine for [Game CI](https://game.ci). Takes whatever machines you give it and provides the flexibility, control, and tools to manage your workloads across it. Builds and testing are first-class, but it can handle any resource-intensive workflow your game or application requires. Works with any infrastructure, any game engine, and any CI system.

Massive time savings are possible -especially for large projects -through engine-aware caching, incremental sync, and retained workspaces. Tools that don't work effortlessly together out of the box (S3, Docker, Kubernetes, Git LFS, rclone, cloud providers) come pre-integrated so you don't have to glue them together yourself.

```mermaid
flowchart LR
  subgraph input["Input"]
    A["GitHub Actions · GitLab CI · CLI"]
  end
  subgraph orchestrator["Orchestrator"]
    direction TB
    E["Engine Plugin"] --> S["Services<br/>(cache, sync, hooks, output)"]
    S --> P["Provider Dispatch"]
  end
  subgraph targets["Build Target"]
    C["Cloud (AWS, GCP, Azure)<br/>Container (K8s, Docker)<br/>CI (GitHub, GitLab)<br/>Custom (CLI protocol)"]
  end
  A --> E
  P --> C
  C -- "artifacts + logs" --> A
```

## Features

- **Engine agnostic**: Unity built-in, with a [plugin system](#engine-plugins) for Godot, Unreal, and custom engines
- **Multi-provider**: AWS Fargate, Kubernetes, GCP Cloud Run, Azure ACI, GitHub Actions, GitLab CI, Ansible, Remote PowerShell, local Docker, local system
- **Custom providers**: write your own in any language via the [CLI provider protocol](#custom-providers-via-cli-protocol)
- **CLI + CI**: `game-ci build` from your terminal, or as a step in GitHub Actions / GitLab CI workflows
- **Container hooks**: composable pre/post-build scripts with phase, provider, and platform filters
- **Caching**: engine-aware asset caching, retained workspaces, incremental file sync
- **Hot runner**: keep build environments warm for sub-minute iteration
- **Reliability**: automatic retries, health checks, provider fallback, failure recovery
- **Outputs**: artifact management, structured test results, real-time log streaming, Git LFS support

## Install

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/game-ci/orchestrator/main/install.sh | sh
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/game-ci/orchestrator/main/install.ps1 | iex
```

### Options

| Variable          | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `GAME_CI_VERSION` | Pin a specific release (e.g. `v2.0.0`). Defaults to latest. |
| `GAME_CI_INSTALL` | Override install directory. Defaults to `~/.game-ci/bin`.   |

Pre-built binaries are also available on the [Releases](https://github.com/game-ci/orchestrator/releases) page.

## Quick Start

### GitHub Actions

```yaml
- uses: game-ci/unity-builder@v4
  with:
    providerStrategy: aws # or k8s, local-docker, etc.
    targetPlatform: StandaloneLinux64
    gitPrivateToken: ${{ secrets.GITHUB_TOKEN }}
```

### CLI

```bash
# Build remotely
game-ci build \
  --providerStrategy aws \
  --projectPath ./my-unity-project \
  --targetPlatform StandaloneLinux64

# Check build status
game-ci status --providerStrategy aws
```

## Quick Start: Godot & Unreal Engine

The orchestrator supports any engine via `--custom-job`. Use `--provider-strategy local-docker` for local Docker builds or `local-system` to run directly on the host.

### Godot — Local Docker

```bash
game-ci orchestrate \
  --engine godot \
  --provider-strategy local-docker \
  --target-platform linux \
  --custom-job '- name: godot-export
  image: barichello/godot-ci:4.3
  commands: |
    godot --headless --export-release "Linux/X11" /build/output/game'
```

### Godot — Local System

```bash
game-ci orchestrate \
  --engine godot \
  --provider-strategy local-system \
  --target-platform linux \
  --custom-job '- name: godot-export
  image: local
  commands: |
    godot --headless --export-release "Linux/X11" ./build/game'
```

### Unreal Engine — Local Docker

UE Docker images are large (35–120 GB). Choose an image source based on your access:

| Image                                                                      | Size   | Access                                                                                               |
| -------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `ghcr.io/epicgames/unreal-engine:dev-slim-5.4`                             | ~35 GB | Requires [Epic Games GitHub org](https://github.com/EpicGames) membership                            |
| [Community UE5 images](https://unrealcontainers.com/docs/obtaining-images) | ~40 GB | Self-built from your UE license via [ue5-docker](https://github.com/evoverses/ue5-docker) or similar |

```bash
game-ci orchestrate \
  --engine unreal \
  --provider-strategy local-docker \
  --target-platform linux \
  --custom-job '- name: ue-build
  image: ghcr.io/epicgames/unreal-engine:dev-slim-5.4
  commands: |
    /home/ue4/UnrealEngine/Engine/Build/BatchFiles/RunUAT.sh \
      BuildCookRun \
      -project=/build/MyProject.uproject \
      -targetplatform=Linux \
      -clientconfig=Shipping \
      -build -cook -stage -pak -archive \
      -archivedirectory=/build/output \
      -noP4 -unattended'
```

### Unreal Engine — Local System

Runs directly on the host using your local UE installation:

```bash
game-ci orchestrate \
  --engine unreal \
  --provider-strategy local-system \
  --target-platform linux \
  --custom-job '- name: ue-build
  image: local
  commands: |
    /path/to/UnrealEngine/Engine/Build/BatchFiles/RunUAT.sh \
      BuildCookRun \
      -project=$(pwd)/MyProject.uproject \
      -targetplatform=Linux \
      -clientconfig=Shipping \
      -build -cook -stage -pak -archive \
      -archivedirectory=$(pwd)/output \
      -noP4 -unattended'
```

## Engine Plugins

No game engine logic is hardcoded into the core. Engine-specific behavior is provided through plugins. Unity ships as the built-in default; other engines plug in through the same minimal interface:

```typescript
interface EnginePlugin {
  name: string; // 'unity', 'godot', 'unreal', etc.
  cacheFolders: string[]; // folders to cache between builds
  preStopCommand?: string; // container shutdown command (e.g. license cleanup)
}
```

The orchestrator's Docker-based workflow model generalizes to any engine: builds run in isolated containers with deterministic environments, engine-aware caching, incremental sync, and composable hooks. Adding a new engine doesn't require changing the orchestrator.

```bash
# Unity (default, no config needed)
game-ci build --targetPlatform StandaloneLinux64

# Other engines
game-ci build --engine godot --engine-plugin @game-ci/godot-engine
```

Plugins can be loaded from NPM packages, CLI executables (any language), or Docker images. See the [Engine Plugins guide](docs/engine-plugins.md) for details on writing your own.

## Providers

| Provider          | Strategy flag       | Description                                                                |
| ----------------- | ------------------- | -------------------------------------------------------------------------- |
| AWS ECS Fargate   | `aws`               | Serverless containers on AWS. Auto-provisions CloudFormation, S3, Kinesis. |
| Kubernetes        | `k8s`               | Builds as K8s Jobs with persistent volumes. Works with any cluster.        |
| GCP Cloud Run     | `gcp-cloud-run`     | Serverless containers on Google Cloud.                                     |
| Azure ACI         | `azure-aci`         | Azure Container Instances.                                                 |
| Local Docker      | `local-docker`      | Docker on the current machine. No cloud account needed.                    |
| Local System      | `local-system`      | Run directly on the host. No Docker or cloud needed.                       |
| GitHub Actions    | `github-actions`    | Dispatch builds to GitHub Actions workflows.                               |
| GitLab CI         | `gitlab-ci`         | Trigger builds on GitLab CI pipelines.                                     |
| Ansible           | `ansible`           | Orchestrate builds via Ansible playbooks.                                  |
| Remote PowerShell | `remote-powershell` | Run builds on remote Windows machines.                                     |

All providers implement the same `ProviderInterface`, so every provider gets caching, hooks, middleware, and artifact management automatically.

### Custom Providers via CLI Protocol

Write providers in any language. The orchestrator communicates with your executable via JSON over stdin/stdout:

```mermaid
flowchart LR
  subgraph orch["Orchestrator"]
    O["Spawns your binary<br/>per subcommand"]
  end
  subgraph exec["Your Executable"]
    E["setup-workflow<br/>run-task<br/>cleanup-workflow"]
  end
  O -- "argv[1] + JSON stdin" --> E
  E -- "JSON stdout" --> O
  E -. "stderr → log" .-> O
```

```bash
game-ci build \
  --providerExecutable ./my-provider \
  --projectPath ./my-unity-project \
  --targetPlatform StandaloneLinux64
```

See the [CLI Provider Protocol docs](docs/cli-provider-protocol.md) for the full specification.

## Development

```bash
yarn install          # Install dependencies
yarn test             # Run tests
yarn build            # Compile TypeScript
yarn game-ci --help   # Run CLI locally
yarn format           # Format with prettier
```

Requires Node.js >= 20 and Yarn 1.x.

## Documentation

- [Engine Plugins](docs/engine-plugins.md)
- [CLI Provider Protocol](docs/cli-provider-protocol.md)
- [Services](docs/services.md)
- [Provider Loader & Dynamic Loading](src/model/orchestrator/providers/README.md)

## Related

- [game-ci/unity-builder](https://github.com/game-ci/unity-builder) -GitHub Action that uses this package as an optional dependency
- [game-ci/documentation](https://github.com/game-ci/documentation) -Docusaurus docs site

## License

MIT
