> **EXPERIMENTAL — NOT IMPLEMENTED.** A structural draft only: this plugin registers options
> but does not yet wrap any build output (`onLoad` warns on load, saying so). Not published
> to npm, and never loaded unless you pass `--plugin @game-ci/anti-cheat` explicitly.

# @game-ci/anti-cheat (draft)

Wraps EasyAntiCheat/BattlEye SDK integration into the build pipeline.
Unlike most of this batch, this is an _options_ plugin, not a new
command - anti-cheat integration happens as part of an existing
build/orchestrate run, not as a separate verb.

## Why this

Real, fiddly, currently entirely hand-rolled per multiplayer studio -
no existing game-ci coverage.

## Remaining work before this is real

1. Decide the actual integration point: most likely a post-build hook via
   `plugins/orchestrator`'s existing middleware/hooks system (see its
   `command-hooks`/`container-hooks` pattern) rather than a bespoke
   mechanism here.
2. EasyAntiCheat and BattlEye each have their own SDK integration steps
   (binary signing/wrapping, game-ID registration) - needs real
   verification against each SDK's actual documented integration process
   before any of this is implemented, since both are commercial SDKs with
   NDA-adjacent distribution terms worth checking first.
3. Options surface: `--enableAntiCheat` (default off, matching game-ci's
   convention for a real behavior change), `--antiCheatProvider`,
   provider-specific game-ID options.
4. Tests once the above is real.
