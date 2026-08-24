import { describe, it, expect } from "vitest";
import { parseSteamCmdOutput } from "./parse-steamcmd-output";

describe("parseSteamCmdOutput", () => {
  it("reports success and captures the BuildID when the output explicitly confirms success", () => {
    const output = "Uploading content...\nSuccessfully finished AppID 123 build (BuildID 45678910).\n";

    const result = parseSteamCmdOutput(output, 0);

    expect(result.success).toBe(true);
    expect(result.buildId).toBe("45678910");
  });

  it("treats exit code 0 with no explicit confirmation and no error markers as success", () => {
    // Real SteamCMD behavior: it doesn't always print the confirmation line even on a genuine success.
    const output = "Uploading content...\ndone.\n";

    const result = parseSteamCmdOutput(output, 0);

    expect(result.success).toBe(true);
    expect(result.buildId).toBe("");
  });

  it("reports failure with a specific reason when the Steam connection dropped", () => {
    const output = "Logging in...\ndisconnected from steam\n";

    const result = parseSteamCmdOutput(output, 1);

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("connection dropped");
  });

  it("reports failure with a specific reason when the depot build itself failed, even at exit code 0", () => {
    // Real SteamCMD behavior: a depot build failure can still exit 0 - the output text is the
    // only reliable signal, which is exactly why exit code alone isn't trusted here.
    const output = "ERROR! Build for depot 1000 failed.\n";

    const result = parseSteamCmdOutput(output, 0);

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("depot build reported failure");
  });

  it("reports failure with a specific reason when the missing-chunks list failed", () => {
    const output = "ERROR! Failed to get list of missing chunks.\n";

    const result = parseSteamCmdOutput(output, 1);

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("missing chunks");
  });

  it("falls back to the raw exit code when no known failure signature is present", () => {
    const output = "Something unexpected happened.\n";

    const result = parseSteamCmdOutput(output, 7);

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("exit code 7");
  });
});
