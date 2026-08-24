> **EXPERIMENTAL — NOT IMPLEMENTED.** This is a structural draft only: the plugin
> shape is real, but its domain logic is not written. Any command it claims will
> throw. It is not published to npm and is never loaded unless you pass
> `--plugin @game-ci/live-show` explicitly.

# @game-ci/live-show (draft)

Scripted/AI-driven attract-mode playthrough that auto-restarts on crash
and can stream output. **Not functional yet**, and `live-show` is not yet
registered anywhere in core's CLI.

## Why this

Doubles as an unattended long-duration soak test - useful both for public
demo/kiosk builds and as a crash-finding tool that just keeps running.

## Remaining work before this is real

1. Add `live-show <buildPath>` to core's `CliCommands`.
2. Decide the "script" mechanism: recorded input replay (shares real
   infrastructure with the input-replay-regression idea from the plugin
   roadmap, if that ever gets built) vs. a genuinely AI-driven agent
   playing live.
3. Crash-restart supervision loop with backoff.
4. Streaming integration (RTMP/Discord/Twitch) - likely just shelling out
   to ffmpeg once capture is wired up.
5. Tests once the above is real.
