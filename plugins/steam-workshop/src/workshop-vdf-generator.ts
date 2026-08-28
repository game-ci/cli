/**
 * Generates SteamCMD's workshop_build_item.vdf - a genuinely different
 * schema and upload target from steam-deploy's appbuild.vdf (that's a
 * full game build; this is a single Workshop item - a mod, map, or asset
 * pack). Schema per Valve's own Steamworks Web API/SDK documentation for
 * `+workshop_build_item`.
 */

export interface WorkshopItemVdfOptions {
  appId: string;
  /** Directory containing the item's content. */
  contentFolder: string;
  /** Path to a preview image (jpg/png/gif), shown on the Workshop page. */
  previewFile?: string;
  title?: string;
  description?: string;
  /** Shown in the item's update history on the Workshop page. */
  changeNote?: string;
  /**
   * 0 = public, 1 = friends-only, 2 = private, 3 = unlisted (Valve's own
   * numeric visibility values). Defaults to 0 (public) when omitted, same
   * as SteamCMD's own default when the field isn't present.
   */
  visibility?: 0 | 1 | 2 | 3;
  /**
   * Set to update an existing Workshop item. Omit to publish a brand new
   * one - SteamCMD assigns a fresh id and it appears in the tool's output
   * (see parse-workshop-output.ts).
   */
  publishedFileId?: string;
}

export function generateWorkshopItemVdf(options: WorkshopItemVdfOptions): string {
  const lines = [
    '"workshopitem"',
    "{",
    `    "appid" "${options.appId}"`,
    ...(options.publishedFileId ? [`    "publishedfileid" "${options.publishedFileId}"`] : []),
    `    "contentfolder" "${options.contentFolder}"`,
    ...(options.previewFile ? [`    "previewfile" "${options.previewFile}"`] : []),
    ...(options.title ? [`    "title" "${options.title}"`] : []),
    ...(options.description ? [`    "description" "${options.description}"`] : []),
    ...(options.changeNote ? [`    "changenote" "${options.changeNote}"`] : []),
    `    "visibility" "${options.visibility ?? 0}"`,
    "}",
  ];

  return lines.join("\n");
}
