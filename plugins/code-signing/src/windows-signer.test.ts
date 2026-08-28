import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { WindowsSigner, signtoolArgs } from "./windows-signer";

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

describe("signtoolArgs", () => {
  it("uses /sha1 with a certificate thumbprint", () => {
    const args = signtoolArgs({ filePath: "C:\\build\\Game.exe", certificateThumbprint: "ABCDEF1234" });
    expect(args).toContain("/sha1");
    expect(args).toContain("ABCDEF1234");
    expect(args).not.toContain("/f");
  });

  it("uses /f and /p with a PFX file and password", () => {
    const args = signtoolArgs({ filePath: "C:\\build\\Game.exe", certificatePath: "C:\\cert.pfx", certificatePassword: "secret" });
    expect(args).toContain("/f");
    expect(args).toContain("C:\\cert.pfx");
    expect(args).toContain("/p");
    expect(args).toContain("secret");
  });

  it("omits /p when no password is given for a PFX file", () => {
    const args = signtoolArgs({ filePath: "C:\\build\\Game.exe", certificatePath: "C:\\cert.pfx" });
    expect(args).not.toContain("/p");
  });

  it("includes a timestamp URL when given", () => {
    const args = signtoolArgs({
      filePath: "C:\\build\\Game.exe",
      certificateThumbprint: "ABC",
      timestampUrl: "http://timestamp.example.com",
    });
    expect(args).toContain("/tr");
    expect(args).toContain("http://timestamp.example.com");
    expect(args).toContain("/td");
  });

  it("omits timestamp flags when no timestamp URL is given", () => {
    const args = signtoolArgs({ filePath: "C:\\build\\Game.exe", certificateThumbprint: "ABC" });
    expect(args).not.toContain("/tr");
  });

  it("throws when neither certificatePath nor certificateThumbprint is given", () => {
    expect(() => signtoolArgs({ filePath: "C:\\build\\Game.exe" })).toThrow(/certificatePath or certificateThumbprint/);
  });

  it("ends with the file path being signed", () => {
    const args = signtoolArgs({ filePath: "C:\\build\\Game.exe", certificateThumbprint: "ABC" });
    expect(args[args.length - 1]).toBe("C:\\build\\Game.exe");
  });
});

describe("WindowsSigner", () => {
  it("runs signtool and reports success on exit code 0", async () => {
    const { spawnFn, calls } = fakeSpawn(0);
    const signer = new WindowsSigner(spawnFn);

    const result = await signer.sign({ filePath: "C:\\build\\Game.exe", certificateThumbprint: "ABC" });

    expect(result.success).toBe(true);
    expect(calls[0].command).toBe("signtool");
  });

  it("reports failure output on a non-zero exit", async () => {
    const { spawnFn } = fakeSpawn(1, "SignTool Error: No certificates were found");
    const signer = new WindowsSigner(spawnFn);

    const result = await signer.sign({ filePath: "C:\\build\\Game.exe", certificateThumbprint: "ABC" });

    expect(result.success).toBe(false);
    expect(result.output).toContain("No certificates were found");
  });
});
