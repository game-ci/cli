# @game-ci/steam-deploy

> **EXPERIMENTAL.** Implemented and loaded by default, but its behaviour and options
> may still change without a major version bump. A Steam upload cannot be undone, so
> verify against a test branch before pointing it at a live one.

`game-ci deploy steam <buildPath>` - generates the app/depot VDFs and runs SteamCMD,
either locally or in Docker.

Credentials are read from the environment (never passed as CLI arguments, since argv
can leak through process listings and command logging).
