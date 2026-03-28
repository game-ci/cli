# GameCI CLI

Build automation for game engines — Unity, Unreal Engine, Godot, and more.

The CLI is a thin, plugin-based runtime. Engine support, cloud providers, and remote build orchestration are loaded as plugins.

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
game-ci remote build --providerStrategy local-docker
```

## Plugin System

The CLI discovers functionality through plugins. Built-in plugins ship with the CLI; external plugins can be loaded from npm, local paths, or GitHub.

### Built-in

- **Unity** — engine detection, build commands, platform setup

### External (loaded at runtime)

```bash
game-ci --plugin @game-ci/orchestrator-plugin remote build --providerStrategy aws
```

Plugins can register:
- **Engine detectors** — detect project engines (Unity, UE5, Godot)
- **Commands** — add CLI subcommands
- **Options** — add CLI flags
- **Providers** — remote build providers (AWS, K8s, local-docker)

See `src/plugin/plugin-interface.ts` for the plugin API.

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
