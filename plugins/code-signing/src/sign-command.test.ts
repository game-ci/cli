import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SignCommand } from "./sign-command";
import { MacosSigner } from "./macos-signer";
import { WindowsSigner } from "./windows-signer";

function ok(output = "") {
  return { success: true, output, exitCode: 0 };
}

function fail(output: string) {
  return { success: false, output, exitCode: 1 };
}

describe("SignCommand", () => {
  let tempDir: string;
  const envKeys = ["APPLE_SIGNING_IDENTITY", "APPLE_ID", "APPLE_TEAM_ID", "APPLE_APP_SPECIFIC_PASSWORD", "WINDOWS_CERTIFICATE_PASSWORD"];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sign-command-test-"));
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  function macosSignerStub(overrides: Partial<Record<"codesign" | "ditto" | "notarize" | "staple", any>> = {}) {
    return {
      codesign: vi.fn().mockResolvedValue(ok()),
      ditto: vi.fn().mockResolvedValue(ok()),
      notarize: vi.fn().mockResolvedValue(ok()),
      staple: vi.fn().mockResolvedValue(ok()),
      ...overrides,
    } as unknown as MacosSigner;
  }

  function windowsSignerStub(overrides: Partial<Record<"sign", any>> = {}) {
    return { sign: vi.fn().mockResolvedValue(ok()), ...overrides } as unknown as WindowsSigner;
  }

  it("throws when the build path does not exist", async () => {
    const command = new SignCommand(macosSignerStub(), windowsSignerStub());
    await expect(command.execute({ buildPath: path.join(tempDir, "nope"), platform: "macos" })).rejects.toThrow(/does not exist/);
  });

  it("throws on an unknown platform", async () => {
    const command = new SignCommand(macosSignerStub(), windowsSignerStub());
    await expect(command.execute({ buildPath: tempDir, platform: "linux" })).rejects.toThrow(/Unknown --platform/);
  });

  describe("macOS", () => {
    it("throws when no identity is given (option or env var)", async () => {
      const command = new SignCommand(macosSignerStub(), windowsSignerStub());
      await expect(command.execute({ buildPath: tempDir, platform: "macos" })).rejects.toThrow(/identity/);
    });

    it("signs and skips notarization when --notarize=false", async () => {
      const macos = macosSignerStub();
      const command = new SignCommand(macos, windowsSignerStub());

      const result = await command.execute({ buildPath: tempDir, platform: "macos", identity: "id", notarize: false });

      expect(result).toBe(true);
      expect(macos.codesign).toHaveBeenCalled();
      expect(macos.notarize).not.toHaveBeenCalled();
    });

    it("throws when notarization credentials are missing", async () => {
      const command = new SignCommand(macosSignerStub(), windowsSignerStub());
      await expect(command.execute({ buildPath: tempDir, platform: "macos", identity: "id" })).rejects.toThrow(
        /APPLE_ID/,
      );
    });

    it("signs, zips, notarizes, and staples when notarization credentials are set", async () => {
      process.env.APPLE_ID = "dev@example.com";
      process.env.APPLE_TEAM_ID = "TEAM123";
      process.env.APPLE_APP_SPECIFIC_PASSWORD = "app-specific-pw";
      const macos = macosSignerStub();
      const command = new SignCommand(macos, windowsSignerStub());

      const result = await command.execute({ buildPath: tempDir, platform: "macos", identity: "id" });

      expect(result).toBe(true);
      expect(macos.codesign).toHaveBeenCalled();
      expect(macos.ditto).toHaveBeenCalled();
      expect(macos.notarize).toHaveBeenCalledWith(
        expect.objectContaining({ appleId: "dev@example.com", teamId: "TEAM123", appSpecificPassword: "app-specific-pw" }),
      );
      expect(macos.staple).toHaveBeenCalled();
    });

    it("throws with codesign's output when signing fails", async () => {
      const macos = macosSignerStub({ codesign: vi.fn().mockResolvedValue(fail("no identity found")) });
      const command = new SignCommand(macos, windowsSignerStub());

      await expect(command.execute({ buildPath: tempDir, platform: "macos", identity: "id", notarize: false })).rejects.toThrow(
        /no identity found/,
      );
    });

    it("throws with notarytool's output when notarization fails", async () => {
      process.env.APPLE_ID = "a";
      process.env.APPLE_TEAM_ID = "t";
      process.env.APPLE_APP_SPECIFIC_PASSWORD = "p";
      const macos = macosSignerStub({ notarize: vi.fn().mockResolvedValue(fail("invalid credentials")) });
      const command = new SignCommand(macos, windowsSignerStub());

      await expect(command.execute({ buildPath: tempDir, platform: "macos", identity: "id" })).rejects.toThrow(
        /invalid credentials/,
      );
    });
  });

  describe("Windows", () => {
    it("throws when neither certificatePath nor certificateThumbprint is given", async () => {
      const command = new SignCommand(macosSignerStub(), windowsSignerStub());
      await expect(command.execute({ buildPath: tempDir, platform: "windows" })).rejects.toThrow(
        /--certificatePath or --certificateThumbprint/,
      );
    });

    it("signs successfully with a certificate thumbprint", async () => {
      const windows = windowsSignerStub();
      const command = new SignCommand(macosSignerStub(), windows);

      const result = await command.execute({ buildPath: tempDir, platform: "windows", certificateThumbprint: "ABC" });

      expect(result).toBe(true);
      expect(windows.sign).toHaveBeenCalledWith(expect.objectContaining({ certificateThumbprint: "ABC" }));
    });

    it("reads the certificate password from the environment, not options", async () => {
      process.env.WINDOWS_CERTIFICATE_PASSWORD = "env-secret";
      const windows = windowsSignerStub();
      const command = new SignCommand(macosSignerStub(), windows);

      await command.execute({ buildPath: tempDir, platform: "windows", certificatePath: "C:\\cert.pfx" });

      expect(windows.sign).toHaveBeenCalledWith(expect.objectContaining({ certificatePassword: "env-secret" }));
    });

    it("throws with signtool's output when signing fails", async () => {
      const windows = windowsSignerStub({ sign: vi.fn().mockResolvedValue(fail("no certificates found")) });
      const command = new SignCommand(macosSignerStub(), windows);

      await expect(
        command.execute({ buildPath: tempDir, platform: "windows", certificateThumbprint: "ABC" }),
      ).rejects.toThrow(/no certificates found/);
    });
  });
});
