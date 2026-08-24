# @game-ci/dev-tunnel (draft)

nginx/Caddy local routing plus a Cloudflare quick tunnel for ephemeral,
testing-only public exposure of a local dev endpoint, with an explicit
public-vs-private publish mode for the resolved URL. **Not functional
yet**, and `tunnel` is not yet registered anywhere in core's CLI.

## Why this - and an important limitation to keep

Cloudflare's own docs are explicit that quick/unnamed tunnels
(`trycloudflare.com`, no Cloudflare account) are testing/development only

- no SLA, a 200 concurrent-request cap, no guaranteed uptime. This plugin
  should stay scoped to that intended use ("let a teammate reach my local
  build") and not grow into a production tunnel manager - a **named**
  tunnel (tied to a Cloudflare account/zone) is the correct path for
  anything long-running, and is out of scope here on purpose.

The publish step matters for the same reason: a GitHub Pages site is
publicly reachable regardless of whether the source repo is private,
_unless_ the org is specifically on GitHub Enterprise Cloud (confirmed
against GitHub's own docs). `--publish=pages` should be treated as
public-by-default, and `--publish=private-remote` (rclone/webhook) should
be the default recommendation for anything not meant to be public.

## Remaining work before this is real

1. Add `tunnel` to core's `CliCommands`.
2. nginx/Caddy config generation for named local routes.
3. Cloudflare quick-tunnel invocation (`cloudflared tunnel --url`) and
   resolved-URL extraction from its output.
4. Both publish modes, with `--publish=pages` requiring an explicit
   confirmation flag given the public-by-default behavior above.
5. Tests once the above is real.
