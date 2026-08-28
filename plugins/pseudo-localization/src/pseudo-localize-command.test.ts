import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PseudoLocalizeCommand } from "./pseudo-localize-command";

describe("PseudoLocalizeCommand", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pseudo-localize-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when the project path does not exist", async () => {
    const command = new PseudoLocalizeCommand();
    await expect(command.execute({ projectPath: path.join(tempDir, "nope") })).rejects.toThrow(/does not exist/);
  });

  it("throws when no source table is found for the given locale", async () => {
    const command = new PseudoLocalizeCommand();
    await expect(command.execute({ projectPath: tempDir, sourceLocale: "en" })).rejects.toThrow(/No source localization table found/);
  });

  it("throws when the source table has no strings", async () => {
    fs.writeFileSync(path.join(tempDir, "en.json"), "{}");
    const command = new PseudoLocalizeCommand();
    await expect(command.execute({ projectPath: tempDir })).rejects.toThrow(/contains no strings/);
  });

  it("writes a pseudo-localized JSON table alongside the source, under the output locale's name", async () => {
    fs.writeFileSync(path.join(tempDir, "en.json"), JSON.stringify({ play: "Play", quit: "Quit" }));

    const command = new PseudoLocalizeCommand();
    const result = await command.execute({ projectPath: tempDir });

    expect(result).toBe(true);
    const outputPath = path.join(tempDir, "qps-ploc.json");
    expect(fs.existsSync(outputPath)).toBe(true);

    const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    expect(Object.keys(output)).toEqual(["play", "quit"]);
    expect(output.play).not.toBe("Play");
    expect(output.play).toContain("!!!");
  });

  it("writes a CSV table when the source is CSV", async () => {
    fs.writeFileSync(path.join(tempDir, "en.csv"), "play,Play\nquit,Quit\n");

    const command = new PseudoLocalizeCommand();
    await command.execute({ projectPath: tempDir });

    expect(fs.existsSync(path.join(tempDir, "qps-ploc.csv"))).toBe(true);
  });

  it("respects a custom outputLocale and outputPath", async () => {
    fs.writeFileSync(path.join(tempDir, "en.json"), JSON.stringify({ play: "Play" }));
    const outDir = path.join(tempDir, "out");

    const command = new PseudoLocalizeCommand();
    await command.execute({ projectPath: tempDir, outputLocale: "de-DE-pseudo", outputPath: outDir });

    expect(fs.existsSync(path.join(outDir, "de-DE-pseudo.json"))).toBe(true);
  });

  it("applies the configured expansionFactor", async () => {
    fs.writeFileSync(path.join(tempDir, "en.json"), JSON.stringify({ greeting: "Hello there, welcome to the game" }));

    const command = new PseudoLocalizeCommand();
    await command.execute({ projectPath: tempDir, expansionFactor: 2 });

    const output = JSON.parse(fs.readFileSync(path.join(tempDir, "qps-ploc.json"), "utf8"));
    // Strip the bracket markers this test doesn't care about to compare raw length growth.
    const inner = output.greeting.replace(/^\[!!! /, "").replace(/ !!!\]$/, "");
    expect(inner.length).toBeGreaterThanOrEqual(Math.ceil("Hello there, welcome to the game".length * 2));
  });
});
