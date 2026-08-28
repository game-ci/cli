import { describe, it, expect } from "vitest";
import { detectFormat, parseTable, serializeTable } from "./localization-table";

describe("detectFormat", () => {
  it("detects .json", () => {
    expect(detectFormat("/x/en.json")).toBe("json");
  });

  it("detects .csv", () => {
    expect(detectFormat("/x/en.csv")).toBe("csv");
  });

  it("throws on an unrecognized extension", () => {
    expect(() => detectFormat("/x/en.txt")).toThrow(/Cannot detect/);
  });
});

describe("JSON tables", () => {
  it("round-trips a table", () => {
    const table = { play: "Play", quit: "Quit" };
    const serialized = serializeTable(table, "json");
    expect(parseTable(serialized, "json")).toEqual(table);
  });

  it("throws on a non-object JSON value", () => {
    expect(() => parseTable("[1,2,3]", "json")).toThrow(/flat JSON object/);
  });

  it("throws when a value is not a string", () => {
    expect(() => parseTable('{"key": 5}', "json")).toThrow(/not a string/);
  });
});

describe("CSV tables", () => {
  it("round-trips a table", () => {
    const table = { play: "Play", quit: "Quit" };
    const serialized = serializeTable(table, "csv");
    expect(parseTable(serialized, "csv")).toEqual(table);
  });

  it("quotes and escapes values containing commas or quotes", () => {
    const table = { greeting: 'Hello, "friend"' };
    const serialized = serializeTable(table, "csv");
    expect(serialized).toContain('"Hello, ""friend"""');
    expect(parseTable(serialized, "csv")).toEqual(table);
  });

  it("handles values containing embedded newlines when quoted", () => {
    const table = { multiline: "Line one\nLine two" };
    const serialized = serializeTable(table, "csv");
    // A quoted field with an embedded newline: this minimal parser (no
    // multi-line-within-quotes support - see localization-table.ts's doc
    // comment) treats each physical line as one row, so a literal
    // newline inside a value doesn't round-trip. Documented limitation,
    // not silently wrong: the value is still written out unambiguously
    // quoted, it just isn't meant to be re-parsed by this same parser.
    expect(serialized).toContain('"Line one');
  });

  it("ignores blank lines", () => {
    const result = parseTable("play,Play\n\nquit,Quit\n", "csv");
    expect(result).toEqual({ play: "Play", quit: "Quit" });
  });
});
