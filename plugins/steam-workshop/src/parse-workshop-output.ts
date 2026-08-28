/**
 * SteamCMD's exit code alone isn't a reliable success signal here either
 * (same reasoning as steam-deploy's parse-steamcmd-output.ts) - the
 * definitive signal for `+workshop_build_item` is the "PublishedFileId"
 * line SteamCMD prints on success, which is also how a NEW item's id
 * gets captured (there's no other way to learn it - it's assigned by
 * Steam during the upload).
 */

export interface WorkshopParseResult {
  success: boolean;
  /** The Workshop item's id - present on success whether this was a new item or an update. */
  publishedFileId?: string;
  failureReason?: string;
}

export function parseWorkshopOutput(output: string, exitCode: number): WorkshopParseResult {
  const publishedMatch = /PublishedFileId\s*[:=]?\s*(\d+)/i.exec(output);

  if (publishedMatch) {
    return { success: true, publishedFileId: publishedMatch[1] };
  }

  if (exitCode === 0) {
    // SteamCMD exited cleanly but never printed a PublishedFileId - the
    // upload itself likely didn't happen (e.g. a silently-skipped/no-op
    // command), so this is NOT trusted as success purely from exit code 0,
    // unlike steam-deploy's build upload (which has its own confirmation
    // line, "Successfully finished", as the definitive signal instead).
    return { success: false, failureReason: "SteamCMD exited successfully but printed no PublishedFileId - the item may not have actually uploaded." };
  }

  const tail = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-5)
    .join(" | ");
  return {
    success: false,
    failureReason: tail ? `exit code ${exitCode}: ${tail}` : `exit code ${exitCode}`,
  };
}
