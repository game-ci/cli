import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SteamDeployCommand } from "./steam-deploy-command";

describe("SteamDeployCommand fileMapping/fileProperty parsing", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-deploy-command-test-"));
    process.env.STEAM_USERNAME = "u";
    process.env.STEAM_PASSWORD = "p";
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.STEAM_USERNAME;
    delete process.env.STEAM_PASSWORD;
  });

  async function runAndReadPrimaryDepotVdf(fileMapping?: string[], fileProperty?: string[]) {
    const command = new SteamDeployCommand();
    try {
      await command.execute({
        buildPath: tempDir,
        appId: "999",
        depotId: "1000",
        mode: "local",
        steamCmdPath: path.join(tempDir, "does-not-exist.sh"),
        fileMapping,
        fileProperty,
      });
    } catch {
      // steamcmd isn't actually available in this test env - execute()
      // throws after the VDF files are already written, which is all these
      // tests need.
    }
    return fs.readFileSync(path.join(tempDir, "depot_build_1000.vdf"), "utf8");
  }

  it("writes multiple FileMapping blocks from --fileMapping entries", async () => {
    const vdf = await runAndReadPrimaryDepotVdf(["bin/*=executables/", "docs/*=documentation/"]);

    expect(vdf.split('"FileMapping"').length - 1).toBe(2);
    expect(vdf).toContain('"LocalPath"\t"bin/*"');
    expect(vdf).toContain('"DepotPath"\t"executables/"');
    expect(vdf).toContain('"LocalPath"\t"docs/*"');
    expect(vdf).toContain('"DepotPath"\t"documentation/"');
  });

  it("writes FileProperties blocks from --fileProperty entries", async () => {
    const vdf = await runAndReadPrimaryDepotVdf(undefined, ["bin/config.cfg=userconfig"]);

    expect(vdf).toContain('"FileProperties"');
    expect(vdf).toContain('"LocalPath"\t"bin/config.cfg"');
    expect(vdf).toContain('"Attributes"\t"userconfig"');
  });

  it("throws a clear error for a malformed --fileMapping entry", async () => {
    const command = new SteamDeployCommand();
    await expect(
      command.execute({
        buildPath: tempDir,
        appId: "999",
        depotId: "1000",
        mode: "local",
        steamCmdPath: path.join(tempDir, "does-not-exist.sh"),
        fileMapping: ["no-equals-sign"],
      }),
    ).rejects.toThrow(/Invalid --fileMapping/);
  });

  it("throws a clear error for a malformed --fileProperty entry", async () => {
    const command = new SteamDeployCommand();
    await expect(
      command.execute({
        buildPath: tempDir,
        appId: "999",
        depotId: "1000",
        mode: "local",
        steamCmdPath: path.join(tempDir, "does-not-exist.sh"),
        fileProperty: ["bin/config.cfg=notarealattribute"],
      }),
    ).rejects.toThrow(/Invalid --fileProperty/);
  });
});
