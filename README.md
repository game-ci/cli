# GameCI CLI

Automation for game engines — Unity, Unreal Engine, Godot, and more.

The CLI is a thin, plugin-based runtime. Engine support, provider integrations, and remote job execution are loaded as plugins. Orchestrator is the intended provider/backend layer for local, Docker, and remote execution flows.

## Install

No Node.js or package manager required. Download a standalone binary:

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/game-ci/cli/main/install.sh | sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/game-ci/cli/main/install.ps1 | iex
```

### Options

| Variable | Description | Default |
|---|---|---|
| `GAME_CI_VERSION` | Pin a specific version (e.g. `v0.1.0`) | latest |
| `GAME_CI_INSTALL` | Override install directory | `~/.game-ci/bin` |

After install, add `~/.game-ci/bin` to your `PATH` (the installer will prompt you).

### From source (requires [Bun](https://bun.sh))

```bash
git clone https://github.com/game-ci/cli.git
cd cli
bun install
bun run start -- --help
```

## Usage

```bash
game-ci --help
game-ci build --engine unity --projectPath ./my-project
game-ci remote run --providerStrategy local-docker
```

## GitHub Action

Use this repository directly as a GitHub Action to install the CLI on the runner and optionally run
a command.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: game-ci/cli@v0.1.0
        with:
          args: build . --target-platform StandaloneLinux64
```

Leave `args` empty to install `game-ci` for later workflow steps:

```yaml
- uses: game-ci/cli@v0.1.0

- run: game-ci --help
```

By default the action installs the release that matches the action ref when the ref is a version tag
such as `v0.1.0`; branch refs install the latest release. Pin a specific binary with `version`:

```yaml
- uses: game-ci/cli@main
  with:
    version: v0.1.0
    args: --help
```

## Quick Start: Godot

### Godot — Local

```bash
# Export a Godot project (requires Godot installed locally)
godot --headless --export-release "Linux/X11" ./build/game

# Or run tests
godot --headless --script res://tests/run_tests.gd
```

### Godot — Local Docker

```bash
# Export using the community Godot CI image (no local install needed)
docker run --rm \
  -v "$(pwd):/project" \
  -w /project \
  barichello/godot-ci:4.3 \
  godot --headless --export-release "Linux/X11" /project/build/game
```

### Godot via Orchestrator (Local Docker)

```bash
game-ci --plugin @game-ci/orchestrator-plugin remote run \
  --engine godot \
  --provider-strategy local-docker \
  --target-platform linux \
  --custom-job '- name: godot-export
  image: barichello/godot-ci:4.3
  commands: |
    godot --headless --export-release "Linux/X11" /build/output/game'
```

### Godot via Orchestrator (Local System)

```bash
game-ci --plugin @game-ci/orchestrator-plugin remote run \
  --engine godot \
  --provider-strategy local-system \
  --target-platform linux \
  --custom-job '- name: godot-export
  image: local
  commands: |
    godot --headless --export-release "Linux/X11" ./build/game'
```

## Quick Start: Unreal Engine

### Unreal Engine — Local

Requires a local UE installation. `RunUAT` is in the engine's `Engine/Build/BatchFiles/` directory:

```bash
# Linux / macOS
/path/to/UnrealEngine/Engine/Build/BatchFiles/RunUAT.sh \
  BuildCookRun \
  -project="$(pwd)/MyProject.uproject" \
  -targetplatform=Linux \
  -clientconfig=Shipping \
  -build -cook -stage -pak -archive \
  -archivedirectory="$(pwd)/output" \
  -noP4 -unattended

# Windows
"C:\Program Files\Epic Games\UE_5.4\Engine\Build\BatchFiles\RunUAT.bat" ^
  BuildCookRun ^
  -project="%cd%\MyProject.uproject" ^
  -targetplatform=Win64 ^
  -clientconfig=Shipping ^
  -build -cook -stage -pak -archive ^
  -archivedirectory="%cd%\output" ^
  -noP4 -unattended
```

### Unreal Engine — Local Docker

UE Docker images are large (35–120 GB). Choose an image source based on your access:

| Image | Size | Access |
| --- | --- | --- |
| `ghcr.io/epicgames/unreal-engine:dev-slim-5.4` | ~35 GB | Requires [Epic Games GitHub org](https://github.com/EpicGames) membership |
| [Community UE5 images](https://unrealcontainers.com/docs/obtaining-images) | ~40 GB | Self-built from your UE license via [ue5-docker](https://github.com/evoverses/ue5-docker) or similar |

```bash
# Using the official Epic slim image
docker run --rm \
  -v "$(pwd):/project" \
  -w /project \
  ghcr.io/epicgames/unreal-engine:dev-slim-5.4 \
  /home/ue4/UnrealEngine/Engine/Build/BatchFiles/RunUAT.sh \
    BuildCookRun \
    -project=/project/MyProject.uproject \
    -targetplatform=Linux \
    -clientconfig=Shipping \
    -build -cook -stage -pak -archive \
    -archivedirectory=/project/output \
    -noP4 -unattended
```

### Unreal Engine via Orchestrator (Local Docker)

```bash
game-ci --plugin @game-ci/orchestrator-plugin remote run \
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

### Unreal Engine via Orchestrator (Local System)

Runs directly on the host using your local UE installation:

```bash
game-ci --plugin @game-ci/orchestrator-plugin remote run \
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

## Plugin System

The CLI discovers functionality through plugins. Built-in plugins ship with the CLI; external plugins can be loaded from npm, local paths, or GitHub.

### Built-in

- **Unity** — engine detection, build commands, platform setup

### External (loaded at runtime)

```bash
game-ci --plugin @game-ci/orchestrator-plugin remote run --providerStrategy aws
```

Plugins can register:
- **Engine detectors** — detect project engines (Unity, UE5, Godot)
- **Commands** — add CLI subcommands
- **Options** — add CLI flags
- **Providers** — remote job providers (AWS, K8s, local-docker)

See `src/plugin/plugin-interface.ts` for the plugin API.

## CI Coverage Notes

The Unreal Engine CI coverage in this repo uses a lightweight AutomationTool-compatible stub for validation on GitHub runners.

That stub is only for CI and workflow-shape verification. It is not presented as a production Unreal runtime. Real Unreal builds are expected to run either:
- against a local UE installation
- against a real UE-capable container image
- through an orchestrator/provider backend that targets one of those environments

## Development

Requires [Bun](https://bun.sh) >= 1.0.

```bash
bun install           # install dependencies
bun test              # run tests
bun run start         # run CLI
bun run build:binary  # compile standalone binary for current platform
```

## Community

Feel free to join us on
<a href="http://game.ci/discord"><img height="30" src="media/Discord-Logo.svg" alt="Discord" /></a> and engage with the
community.

## Contributing

To help improve the documentation, please find the docs [repository](https://github.com/game-ci/documentation).

To contribute to the CLI, kindly read the [contribution guide](./CONTRIBUTING.md).

## Support us

GameCI is free for everyone forever.

You can support us at [OpenCollective](https://opencollective.com/game-ci).

## Licence

This repository is [MIT](./LICENSE) licensed.

This includes all contributions from the community.
