import { describe, it, expect } from "vitest";
import { pseudoLocalize } from "./pseudo-loc-transform";

describe("pseudoLocalize", () => {
  it("wraps the result in bracket markers by default", () => {
    const result = pseudoLocalize("Play", { useAccentedCharacters: false, expansionFactor: 1 });
    expect(result.startsWith("[!!! ")).toBe(true);
    expect(result.endsWith(" !!!]")).toBe(true);
  });

  it("omits bracket markers when disabled", () => {
    const result = pseudoLocalize("Play", { addBracketMarkers: false, useAccentedCharacters: false, expansionFactor: 1 });
    expect(result).not.toContain("!!!");
  });

  it("replaces ASCII letters with accented lookalikes", () => {
    const result = pseudoLocalize("Play", { addBracketMarkers: false, expansionFactor: 1 });
    expect(result).not.toBe("Play");
    // Still recognizable/roughly the same length before expansion.
    expect(result.length).toBeGreaterThanOrEqual("Play".length);
  });

  it("expands the string length by roughly the given factor", () => {
    const source = "New Game";
    const result = pseudoLocalize(source, { addBracketMarkers: false, useAccentedCharacters: false, expansionFactor: 1.5 });
    expect(result.length).toBeGreaterThanOrEqual(Math.ceil(source.length * 1.5));
  });

  it("does not expand when expansionFactor is 1", () => {
    const source = "OK";
    const result = pseudoLocalize(source, { addBracketMarkers: false, useAccentedCharacters: false, expansionFactor: 1 });
    expect(result).toBe(source);
  });

  it("leaves {placeholder} format tokens untouched", () => {
    const result = pseudoLocalize("Hello {playerName}", { addBracketMarkers: false, expansionFactor: 1 });
    expect(result).toContain("{playerName}");
  });

  it("leaves %s-style format tokens untouched", () => {
    const result = pseudoLocalize("You have %d lives", { addBracketMarkers: false, expansionFactor: 1 });
    expect(result).toContain("%d");
  });

  it("leaves simple markup tags untouched", () => {
    const result = pseudoLocalize("<b>Continue</b>", { addBracketMarkers: false, expansionFactor: 1 });
    expect(result).toContain("<b>");
    expect(result).toContain("</b>");
  });

  it("returns an empty string unchanged", () => {
    expect(pseudoLocalize("")).toBe("");
  });
});
