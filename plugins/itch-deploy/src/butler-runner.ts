import { spawn } from "node:child_process";

export interface RunButlerPushOptions {
  /** Directory or zip to push. */
  buildDir: string;
  /** "user/game". */
  target: string;
  channel: string;
  /** Explicit path to the butler executable. Recommended for CI determinism; defaults to "butler" (resolved via PATH). */
  butlerPath?: string;
  /** Tags this push with a custom version string, shown in itch.io's build history (butler's own --userversion flag). */
  userVersion?: string;
  /** Glob patterns excluded from the push (butler's own repeatable --ignore flag). */
  ignore?: string[];
}

export interface ButlerPushResult {
  success: boolean;
  /** Populated on failure with the tail of butler's own output, for diagnostics. */
  failureReason?: string;
}

type SpawnFn = typeof spawn;

function pushArgs(options: RunButlerPushOptions): string[] {
  const args = ["push", options.buildDir, `${options.target}:${options.channel}`];

  if (options.userVersion) {
    args.push("--userversion", options.userVersion);
  }
  for (const pattern of options.ignore ?? []) {
    args.push("--ignore", pattern);
  }

  return args;
}

/**
 * Runs `butler push`. Butler is a modern Go CLI with sane exit-code
 * semantics (unlike steamcmd's well-documented "exit 0 can still mean
 * failure" quirk - see steam-deploy's parse-steamcmd-output.ts) - success
 * is trusted from the exit code directly, and only failures need their
 * output surfaced for diagnostics.
 *
 * Requires butler already installed and on PATH (or at --butlerPath).
 * Unlike steam-deploy's docker fallback (a well-known, stable
 * cm2network/steamcmd image), this repo doesn't have a verified official
 * itch.io/butler Docker image to fall back to - adding one later is a
 * follow-up, not guessed at here (same "don't ship unverified domain
 * logic" reasoning as this repo's other draft plugins).
 */
export class ButlerRunner {
  constructor(private readonly spawnFn: SpawnFn = spawn) {}

  async push(options: RunButlerPushOptions): Promise<ButlerPushResult> {
    const butlerPath = options.butlerPath ?? "butler";
    const args = pushArgs(options);

    return new Promise((resolve, reject) => {
      const child = this.spawnFn(butlerPath, args, { stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout?.on("data", (chunk) => (output += chunk.toString()));
      child.stderr?.on("data", (chunk) => (output += chunk.toString()));
      child.on("error", reject);
      child.on("close", (exitCode) => {
        if (exitCode === 0) {
          resolve({ success: true });
          return;
        }

        const tail = output
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(-5)
          .join(" | ");
        resolve({
          success: false,
          failureReason: tail ? `exit code ${exitCode}: ${tail}` : `exit code ${exitCode}`,
        });
      });
    });
  }
}
