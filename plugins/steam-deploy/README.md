# @game-ci/steam-deploy

> **EXPERIMENTAL.** Implemented and loaded by default, but its behaviour and options
> may still change without a major version bump. A Steam upload cannot be undone, so
> verify against a test branch before pointing it at a live one.

`game-ci deploy steam <buildPath>` - generates the app/depot VDFs and runs SteamCMD,
either locally or in Docker.

Credentials are read from the environment (never passed as CLI arguments, since argv
can leak through process listings and command logging).

For apps with non-consecutive depot IDs, set `--depotId` for the primary depot
and `--depotNId` alongside each extra `--depotNPath`. For example:

```sh
game-ci deploy steam steam-build \
  --appId 1136510 --depotId 1136514 --depotPath windows \
  --depot1Id 1136517 --depot1Path macos \
  --depot2Id 1136518 --depot2Path linux --branch beta
```

If the primary depot is not part of the build, pass `--skipPrimaryDepot` and
configure at least one extra depot path. Extra depot IDs default to the primary
ID plus their slot number; empty slots do not renumber later depots.
