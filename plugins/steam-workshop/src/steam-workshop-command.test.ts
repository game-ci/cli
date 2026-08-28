import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SteamWorkshopCommand } from "./steam-workshop-command";
import * as runnerModule from "./workshop-cmd-runner";

describe("SteamWorkshopCommand", () => {
  let tempDir: string;
  const originalUsername = process.env.STEAM_USERNAME;
  const originalPassword = process.env.STEAM_PASSWORD;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-workshop-test-"));
    process.env.STEAM_USERNAME = "u";
    process.env.STEAM_PASSWORD = "p";
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env.STEAM_USERNAME = originalUsername;
    process.env.STEAM_PASSWORD = originalPassword;
    vi.restoreAllMocks();
  });

  it("throws when the item path is missing", async () => {
    const command = new SteamWorkshopCommand();
    await expect(command.execute({ appId: "480" })).rejects.toThrow(/item path is required/);
  });

  it("throws when the item path does not exist", async () => {
    const command = new SteamWorkshopCommand();
    await expect(command.execute({ itemPath: path.join(tempDir, "nope"), appId: "480" })).rejects.toThrow(/does not exist/);
  });

  it("throws when credentials are not set", async () => {
    delete process.env.STEAM_USERNAME;
    const command = new SteamWorkshopCommand();
    await expect(command.execute({ itemPath: tempDir, appId: "480" })).rejects.toThrow(/STEAM_USERNAME/);
  });

  it("writes the vdf into itemPath and uploads it", async () => {
    const uploadSpy = vi
      .spyOn(runnerModule.WorkshopCmdRunner.prototype, "upload")
      .mockResolvedValue({ success: true, publishedFileId: "555" });

    const command = new SteamWorkshopCommand();
    const result = await command.execute({ itemPath: tempDir, appId: "480", title: "My Mod" });

    expect(result).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "workshop_build_item.vdf"))).toBe(true);
    const vdfContent = fs.readFileSync(path.join(tempDir, "workshop_build_item.vdf"), "utf8");
    expect(vdfContent).toContain('"title" "My Mod"');
    expect(uploadSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workDir: path.resolve(tempDir), vdfFileName: "workshop_build_item.vdf" }),
    );
  });

  it("passes publishedFileId through to the generated vdf when updating", async () => {
    vi.spyOn(runnerModule.WorkshopCmdRunner.prototype, "upload").mockResolvedValue({ success: true, publishedFileId: "555" });

    const command = new SteamWorkshopCommand();
    await command.execute({ itemPath: tempDir, appId: "480", publishedFileId: "555" });

    const vdfContent = fs.readFileSync(path.join(tempDir, "workshop_build_item.vdf"), "utf8");
    expect(vdfContent).toContain('"publishedfileid" "555"');
  });

  it("throws with the runner's failure reason when the upload fails", async () => {
    vi.spyOn(runnerModule.WorkshopCmdRunner.prototype, "upload").mockResolvedValue({
      success: false,
      failureReason: "exit code 1: bad appid",
    });

    const command = new SteamWorkshopCommand();
    await expect(command.execute({ itemPath: tempDir, appId: "480" })).rejects.toThrow(/bad appid/);
  });
});
