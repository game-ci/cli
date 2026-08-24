# @game-ci/dedicated-server-provisioning (draft)

Generates docker-compose/systemd units, firewall/port config, and a
health-check endpoint for self-hosters. **Not functional yet**, and
`provision-server` is not yet registered anywhere in core's CLI.

## Why this, distinct from a server-build plugin

Complements rather than duplicates a build-time headless-server-packaging
step: this is the ops/setup half - "I have a headless server binary, now
help me actually run it" - not the build itself.

## Remaining work before this is real

1. Add `provision-server <buildPath>` to core's `CliCommands`.
2. Docker-compose/systemd unit templates, parameterized by port and
   resource limits.
3. A minimal generic health-check endpoint the game process can expose
   (or a TCP-connect fallback for engines that can't easily add an HTTP
   endpoint).
4. Optionally fold in the nginx-based routing concept from the Dev Tunnel
   plugin's design discussion, if multiple server instances behind one
   host is a real need.
5. Tests once the above is real.
