> **EXPERIMENTAL.** Functional, and registered by default in every `game-ci`
> binary (no `--plugin` flag needed) - not published to npm, so it's loaded
> via a literal `import()` compiled directly into the binary instead.

# @game-ci/pseudo-localization

`game-ci pseudo-localize <projectPath>` injects pseudo-loc strings
pre-translation to catch UI overflow/truncation bugs before real
translation work starts.

## Usage

```bash
game-ci pseudo-localize ./Localization --sourceLocale en --expansionFactor 1.4
```

Reads `<projectPath>/<sourceLocale>.json` or `.csv` (a flat key -> string
table) and writes the pseudo-localized result to
`<projectPath>/<outputLocale>.<same format>`.

## Why this, distinct from translation sync

UI _testing_, not translation management - deliberately different from a
Crowdin/Lokalise-style sync plugin (which was considered and cut from the
roadmap for not being game-specific enough).

## The transform

Three real, well-established pseudo-loc techniques:

1. **Accented lookalikes** replace plain ASCII letters, so any string
   that skipped the pipeline (hardcoded, forgotten) stands out
   immediately in a build.
2. **Length expansion** pads the string (`--expansionFactor`, default
   `1.3`) - most languages run 30-50% longer than English for the same
   meaning, the #1 real cause of UI truncation bugs.
3. **Bracket markers** around the whole string make its exact
   boundaries visible, catching concatenation bugs.

Format placeholders (`{0}`, `{playerName}`, `%s`, `%d`) and simple markup
(`<b>...</b>`) are detected and left untouched, so string
formatting/rich text keeps working on the pseudo-localized output.

## Table format scope

Supports the two most common *generic* flat-table interchange formats -
a plain JSON object (`{"key": "value"}`) and a two-column CSV. Deliberately
**not** engine-specific structured formats (e.g. Unity's binary
StringTable assets) - those need real verification against an actual
engine install before being guessed at, same reasoning as this repo's
other engine-specific draft plugins (see `plugins/gamemaker`'s README).
If your project uses an engine-native format, export/import through a
flat table as an intermediate step, or convert this plugin's output.

## Options

| Option              | Description                                                          |
| -------------------- | ------------------------------------------------------------------ |
| `--sourceLocale`     | Source locale to read. Default `en`.                                |
| `--outputLocale`     | Locale code the output table is written under. Default `qps-ploc`.  |
| `--expansionFactor`  | Length multiplier applied to each string. Default `1.3`.            |
| `--outputPath`       | Directory to write the output table into. Defaults to `projectPath`. |
