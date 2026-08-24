/**
 * SteamCMD's exit code alone is not a reliable success/failure signal - a
 * dropped Steam connection or a depot build failure can still exit 0, and a
 * genuinely successful upload can occasionally exit non-zero after the
 * upload itself completed. This heuristic (ported from a real, production
 * PowerShell deploy script) reads the actual output text instead, in this
 * priority order:
 *
 *  1. "Successfully finished" in the output - definitive success.
 *  2. Exit code 0 with no explicit error markers - treated as success
 *     (SteamCMD doesn't always print the confirmation line even on a real
 *     success).
 *  3. Otherwise: failure, with a specific reason extracted from known
 *     SteamCMD failure signatures where possible (a dropped connection and
 *     a missing-chunks list both mean the upload can usually just be
 *     retried, whereas a depot build failure means the content itself was
 *     rejected).
 */

export interface SteamCmdParseResult {
  success: boolean;
  /** The Steam BuildID, if one appears in the output. Empty string if not found, even on success. */
  buildId: string;
  /** Populated on failure with a specific, actionable reason where the output allows identifying one. */
  failureReason?: string;
}

export function parseSteamCmdOutput(output: string, exitCode: number): SteamCmdParseResult {
  const buildIdMatch = /BuildID\s+(\d+)/.exec(output);
  const buildId = buildIdMatch ? buildIdMatch[1] : "";

  const successConfirmed = /Successfully finished/.test(output);
  const disconnected = /disconnected from steam/i.test(output);
  const errorBuild = /ERROR!.*Build for depot.*failed/.test(output);
  const errorChunks = /ERROR!.*Failed to get list of missing chunks/.test(output);

  if (successConfirmed) {
    return { success: true, buildId };
  }

  if (exitCode === 0 && !errorBuild && !errorChunks) {
    return { success: true, buildId };
  }

  const reasons: string[] = [];
  if (disconnected) reasons.push("Steam connection dropped (request revoked)");
  if (errorChunks) reasons.push("failed to get list of missing chunks (lost connection)");
  if (errorBuild) reasons.push("depot build reported failure");
  if (reasons.length === 0) reasons.push(`exit code ${exitCode}`);

  return { success: false, buildId: "", failureReason: reasons.join("; ") };
}
