# Minimal Unreal Engine Test Project

This directory contains a minimal `.uproject` and a **mock Unreal Engine runtime** for CI testing.

## Why a mock?

Real UE Docker images are 35-120GB — too large for GitHub-hosted runners (22GB free). See [Unreal Engine CI Strategy](../../docs/unreal-engine-ci.md) for the full analysis.

## What's here

```
unreal-minimal/
├── MinimalTest.uproject     # Minimal UE 5.4 project file
├── Dockerfile.ci-stub       # Docker image with mock UE runtime
├── mock-ue/
│   ├── RunUAT.sh            # Mock AutomationTool (full CLI interface)
│   └── UnrealBuildTool.sh   # Mock compiler driver
└── README.md
```

## Mock UE runtime

The mock replicates real UE's:
- **CLI interface** — All `BuildCookRun` arguments (`-build`, `-cook`, `-stage`, `-pak`, `-archive`)
- **Directory layout** — `/home/ue4/UnrealEngine/Engine/Build/BatchFiles/RunUAT.sh`
- **Output format** — `AutomationTool exiting with ExitCode=0 (Success)`
- **Build artifacts** — Binaries, cooked assets, .pak files, staged builds, manifests

## Running locally

```bash
# Build the mock UE container
docker build -t game-ci/ue-mock:latest -f Dockerfile.ci-stub .

# Run a full BuildCookRun pipeline
docker run --rm -v "$(pwd):/build" -w /build game-ci/ue-mock:latest \
  BuildCookRun \
  -project=/build/MinimalTest.uproject \
  -targetplatform=Linux \
  -clientconfig=Shipping \
  -build -cook -stage -pak -archive \
  -archivedirectory=/build/output \
  -noP4 -unattended

# Verify output
cat output/build-manifest.json
```

## Reporting mock drift

If you find that real UE behaves differently from our mock, please [open an issue](https://github.com/game-ci/orchestrator/issues/new) with the `mock-drift` label describing the difference.
