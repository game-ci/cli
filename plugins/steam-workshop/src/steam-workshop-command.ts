import * as fs from "node:fs";
import * as path from "node:path";
import { generateWorkshopItemVdf } from "./workshop-vdf-generator";
import { WorkshopCmdRunner } from "./workshop-cmd-runner";

export interface SteamWorkshopOptions {
  itemPath?: string;
  appId?: string;
  publishedFileId?: string;
  title?: string;
  description?: string;
  changeNote?: string;
  visibility?: number;
  previewImage?: string;
  mode?: string;
  steamCmdPath?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

const VDF_FILE_NAME = "workshop_build_item.vdf";

export class SteamWorkshopCommand {
  public readonly name = "Deploy steam workshop";

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("appId", {
        describe: "Steam App ID the Workshop item belongs to.",
        type: "string",
        demandOption: true,
      })
      .option("publishedFileId", {
        describe: "Existing Workshop item id to update. Omit to publish a new item.",
        type: "string",
      })
      .option("title", { describe: "Item title.", type: "string" })
      .option("description", { describe: "Item description.", type: "string" })
      .option("changeNote", { describe: "Shown in the item's update history on the Workshop page.", type: "string" })
      .option("visibility", {
        describe: "0 = public, 1 = friends-only, 2 = private, 3 = unlisted.",
        type: "number",
        default: 0,
      })
      .option("previewImage", {
        describe: "Path (relative to itemPath) to a preview image (jpg/png/gif).",
        type: "string",
      })
      .option("mode", {
        describe: "How to run steamcmd: auto (default), local, or docker",
        type: "string",
        default: "auto",
      })
      .option("steamCmdPath", {
        describe: "Explicit path to the steamcmd executable. Recommended for CI determinism; skips auto-detection.",
        type: "string",
      });
  }

  public async execute(options: SteamWorkshopOptions): Promise<boolean> {
    const itemPath = options.itemPath;
    if (!itemPath) {
      throw new Error("An item path is required: game-ci deploy steam-workshop <itemPath>");
    }
    if (!fs.existsSync(itemPath)) {
      throw new Error(`Item path does not exist: ${itemPath}`);
    }

    const username = process.env.STEAM_USERNAME;
    const password = process.env.STEAM_PASSWORD;
    if (!username || !password) {
      throw new Error(
        "STEAM_USERNAME and STEAM_PASSWORD must be set as environment variables (never as CLI arguments - argv can leak through process listings).",
      );
    }

    const appId = options.appId!;
    const mode = (options.mode ?? "auto") as "auto" | "local" | "docker";
    const absoluteItemPath = path.resolve(itemPath);
    // Same marker-then-substitute approach as steam-deploy's
    // contentroot/buildoutput: the VDF's contentfolder must be a path
    // steamcmd can actually see - an absolute host path for local mode,
    // or the container mount point for docker.
    const contentFolder = mode === "docker" ? "/build" : absoluteItemPath.replace(/\\/g, "/");

    const vdf = generateWorkshopItemVdf({
      appId,
      contentFolder,
      previewFile: options.previewImage ? `${contentFolder}/${options.previewImage}` : undefined,
      title: options.title,
      description: options.description,
      changeNote: options.changeNote,
      visibility: (options.visibility ?? 0) as 0 | 1 | 2 | 3,
      publishedFileId: options.publishedFileId,
    });

    fs.writeFileSync(path.join(absoluteItemPath, VDF_FILE_NAME), vdf, "utf8");

    const action = options.publishedFileId ? `Updating Workshop item ${options.publishedFileId}` : "Publishing a new Workshop item";
    console.log(`${action} for app ${appId} from ${absoluteItemPath}`);

    const runner = new WorkshopCmdRunner();
    const result = await runner.upload({
      workDir: absoluteItemPath,
      vdfFileName: VDF_FILE_NAME,
      username,
      password,
      mode,
      steamCmdPath: options.steamCmdPath,
    });

    if (!result.success) {
      throw new Error(`Steam Workshop upload failed: ${result.failureReason}`);
    }

    console.log(`Steam Workshop upload succeeded. PublishedFileId: ${result.publishedFileId}`);
    return true;
  }
}
