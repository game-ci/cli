/**
 * Pseudo-localization transform: three real-world, well-established
 * techniques applied to a source string so UI overflow/truncation and
 * missing-localization bugs surface before real translation work ever
 * starts (a widely-used technique - the same three moves iOS's and
 * Android's own pseudo-loc tooling apply).
 *
 *  1. Accented lookalikes replace plain ASCII letters, so any string
 *     that DIDN'T go through this pipeline (hardcoded, forgotten) stands
 *     out immediately in a build.
 *  2. Length expansion pads the string, since most languages (German,
 *     Finnish, ...) run 30-50% longer than English for the same meaning -
 *     this is the #1 real cause of UI truncation bugs.
 *  3. Bracket markers around the whole string make the string's exact
 *     boundaries visible, catching concatenation bugs (e.g. a label built
 *     from two separately-localized fragments).
 */

const ACCENTED_MAP: Record<string, string> = {
  a: "à",
  b: "ƀ",
  c: "ç",
  d: "đ",
  e: "é",
  f: "ƒ",
  g: "ğ",
  h: "ħ",
  i: "î",
  j: "ĵ",
  k: "ķ",
  l: "ļ",
  m: "m̀",
  n: "ñ",
  o: "ö",
  p: "p̀",
  q: "q̀",
  r: "ř",
  s: "š",
  t: "ţ",
  u: "ü",
  v: "v̀",
  w: "ŵ",
  x: "x̀",
  y: "ý",
  z: "ž",
  A: "À",
  B: "Ɓ",
  C: "Ç",
  D: "Đ",
  E: "É",
  F: "Ƒ",
  G: "Ğ",
  H: "Ħ",
  I: "Î",
  J: "Ĵ",
  K: "Ķ",
  L: "Ļ",
  M: "M̀",
  N: "Ñ",
  O: "Ö",
  P: "P̀",
  Q: "Q̀",
  R: "Ř",
  S: "Š",
  T: "Ţ",
  U: "Ü",
  V: "V̀",
  W: "Ŵ",
  X: "X̀",
  Y: "Ý",
  Z: "Ž",
};

export interface PseudoLocalizeOptions {
  /** Multiplier applied to the string's length via padding. 1.0 = no expansion. Typical real-world range: 1.3-1.5. */
  expansionFactor?: number;
  /** Wraps the result in bracket markers, e.g. "[!!! ... !!!]". Default true. */
  addBracketMarkers?: boolean;
  /** Replaces ASCII letters with accented lookalikes. Default true. */
  useAccentedCharacters?: boolean;
}

const DEFAULT_OPTIONS: Required<PseudoLocalizeOptions> = {
  expansionFactor: 1.3,
  addBracketMarkers: true,
  useAccentedCharacters: true,
};

/**
 * Format placeholders ({0}, {name}, %s, %1$s) and simple markup
 * ({{token}}, <b>...</b>) must survive untouched - transforming their
 * contents breaks string formatting/rich text entirely, defeating the
 * whole point of a QA tool. Matched and skipped, not just excluded from
 * the accent map, so length-expansion padding is inserted around them
 * rather than splitting a placeholder in half.
 */
const PLACEHOLDER_PATTERN = /\{[^}]*\}|%\d*\$?[sdif]|<\/?[a-zA-Z][^>]*>/g;

function expand(text: string, expansionFactor: number): string {
  if (expansionFactor <= 1) return text;

  const targetLength = Math.ceil(text.length * expansionFactor);
  const paddingNeeded = targetLength - text.length;
  if (paddingNeeded <= 0) return text;

  // Padded with repeated vowels rather than spaces - visually distinct
  // from real content, and doesn't get silently trimmed by UI layout
  // code the way trailing whitespace often does.
  const padding = " " + "~".repeat(paddingNeeded - 1);
  return text + padding;
}

export function pseudoLocalize(text: string, options: PseudoLocalizeOptions = {}): string {
  const resolved = { ...DEFAULT_OPTIONS, ...options };

  if (text.length === 0) return text;

  let result: string;
  if (resolved.useAccentedCharacters) {
    const segments = text.split(PLACEHOLDER_PATTERN);
    const placeholders = text.match(PLACEHOLDER_PATTERN) ?? [];

    result = segments
      .map((segment, index) => {
        const accented = Array.from(segment)
          .map((char) => ACCENTED_MAP[char] ?? char)
          .join("");
        return index < placeholders.length ? accented + placeholders[index] : accented;
      })
      .join("");
  } else {
    result = text;
  }

  result = expand(result, resolved.expansionFactor);

  if (resolved.addBracketMarkers) {
    result = `[!!! ${result} !!!]`;
  }

  return result;
}
