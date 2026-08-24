# @game-ci/pseudo-localization (draft)

Injects pseudo-loc strings pre-translation to catch UI overflow/
truncation bugs. **Not functional yet**, and `pseudo-localize` is not yet
registered anywhere in core's CLI.

## Why this, distinct from translation sync

UI _testing_, not translation management - deliberately different from a
Crowdin/Lokalise-style sync plugin (which was considered and cut from the
roadmap for not being game-specific enough).

## Remaining work before this is real

1. Add `pseudo-localize <projectPath>` to core's `CliCommands`.
2. Pseudo-loc transform (accented characters, length expansion/padding,
   bracket markers around each string) applied to whatever localization
   table format the target engine uses - this is genuinely
   engine-specific (Unity's Localization package format differs
   completely from a flat JSON/CSV table), so the first real
   implementation will likely need to pick one engine's format to start.
3. Tests once the above is real.
