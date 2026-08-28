import { spawn } from "node:child_process";
import type { RunResult } from "./macos-signer";

type SpawnFn = typeof spawn;

function runProcess(spawnFn: SpawnFn, command: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk.toString()));
    child.stderr?.on("data", (chunk) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ success: exitCode === 0, output, exitCode: exitCode ?? 1 }));
  });
}

export interface WindowsSignOptions {
  filePath: string;
  /** Path to a PFX certificate file. Mutually exclusive with certificateThumbprint (a cert already in the Windows certificate store). */
  certificatePath?: string;
  /** Password for the PFX file. Read from an env var by the caller - never passed as a bare CLI argument here either, though signtool itself has no other way to take it. */
  certificatePassword?: string;
  /** Thumbprint of a certificate already installed in the Windows certificate store, as an alternative to a PFX file. */
  certificateThumbprint?: string;
  /** RFC 3161 timestamp server URL - without this, the signature becomes invalid the moment the certificate expires, even for already-shipped builds. */
  timestampUrl?: string;
}

/**
 * signtool.exe's own documented flag set (Windows SDK). /fd sha256 /td
 * sha256 is the modern (SHA-256 file + timestamp digest) signing mode -
 * signtool's legacy SHA-1-only mode is deprecated by Microsoft and
 * increasingly rejected by SmartScreen.
 */
export function signtoolArgs(options: WindowsSignOptions): string[] {
  const args = ["sign", "/fd", "sha256"];

  if (options.certificateThumbprint) {
    args.push("/sha1", options.certificateThumbprint);
  } else if (options.certificatePath) {
    args.push("/f", options.certificatePath);
    if (options.certificatePassword) {
      args.push("/p", options.certificatePassword);
    }
  } else {
    throw new Error("Either certificatePath or certificateThumbprint is required for Windows signing.");
  }

  if (options.timestampUrl) {
    args.push("/tr", options.timestampUrl, "/td", "sha256");
  }

  args.push(options.filePath);
  return args;
}

export class WindowsSigner {
  constructor(private readonly spawnFn: SpawnFn = spawn) {}

  sign(options: WindowsSignOptions): Promise<RunResult> {
    return runProcess(this.spawnFn, "signtool", signtoolArgs(options));
  }
}
