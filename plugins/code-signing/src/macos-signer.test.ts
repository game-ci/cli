import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { MacosSigner, codesignArgs, dittoZipArgs, notarytoolSubmitArgs, staplerArgs } from "./macos-signer";

function fakeSpawn(exitCode: number, output = "") {
  const calls: Array<{ command: string; args: string[] }> = [];
  const spawnFn = vi.fn((command: string, args: string[]) => {
    calls.push({ command, args });
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      if (output) child.stdout.emit("data", Buffer.from(output));
      child.emit("close", exitCode);
    });
    return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
  });
  return { spawnFn, calls };
}

describe("codesignArgs", () => {
  it("includes --sign, the identity, and hardened-runtime options", () => {
    const args = codesignArgs({ appPath: "/build/Game.app", identity: "Developer ID Application: Studio (TEAM123)" });
    expect(args).toContain("--sign");
    expect(args).toContain("Developer ID Application: Studio (TEAM123)");
    expect(args).toContain("--options");
    expect(args).toContain("runtime");
    expect(args[args.length - 1]).toBe("/build/Game.app");
  });

  it("includes --entitlements only when given", () => {
    const withEntitlements = codesignArgs({ appPath: "/a", identity: "id", entitlementsPath: "/e.plist" });
    expect(withEntitlements).toContain("--entitlements");
    expect(withEntitlements).toContain("/e.plist");

    const without = codesignArgs({ appPath: "/a", identity: "id" });
    expect(without).not.toContain("--entitlements");
  });
});

describe("dittoZipArgs", () => {
  it("preserves the bundle with -k --keepParent", () => {
    const args = dittoZipArgs("/build/Game.app", "/tmp/Game.zip");
    expect(args).toEqual(["-c", "-k", "--keepParent", "/build/Game.app", "/tmp/Game.zip"]);
  });
});

describe("notarytoolSubmitArgs", () => {
  it("builds the expected submit argv", () => {
    const args = notarytoolSubmitArgs({
      archivePath: "/tmp/Game.zip",
      appleId: "dev@example.com",
      teamId: "TEAM123",
      appSpecificPassword: "app-specific-pw",
    });
    expect(args).toEqual([
      "notarytool",
      "submit",
      "/tmp/Game.zip",
      "--apple-id",
      "dev@example.com",
      "--team-id",
      "TEAM123",
      "--password",
      "app-specific-pw",
      "--wait",
    ]);
  });
});

describe("staplerArgs", () => {
  it("builds the expected staple argv", () => {
    expect(staplerArgs("/build/Game.app")).toEqual(["stapler", "staple", "/build/Game.app"]);
  });
});

describe("MacosSigner", () => {
  it("runs codesign and reports success on exit code 0", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const signer = new MacosSigner(spawnFn);

    const result = await signer.codesign({ appPath: "/a", identity: "id" });

    expect(result.success).toBe(true);
    expect(calls[0].command).toBe("codesign");
  });

  it("runs notarize via xcrun and reports failure output on non-zero exit", async () => {
    const { spawnFn, calls } = fakeSpawn(1, "error: invalid credentials");
    const signer = new MacosSigner(spawnFn);

    const result = await signer.notarize({ archivePath: "/z", appleId: "a", teamId: "t", appSpecificPassword: "p" });

    expect(result.success).toBe(false);
    expect(result.output).toContain("invalid credentials");
    expect(calls[0].command).toBe("xcrun");
    expect(calls[0].args[0]).toBe("notarytool");
  });

  it("runs staple via xcrun", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const signer = new MacosSigner(spawnFn);

    await signer.staple("/build/Game.app");

    expect(calls[0].command).toBe("xcrun");
    expect(calls[0].args[0]).toBe("stapler");
  });
});
