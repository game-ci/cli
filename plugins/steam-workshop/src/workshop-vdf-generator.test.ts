import { describe, it, expect } from "vitest";
import { generateWorkshopItemVdf } from "./workshop-vdf-generator";

describe("generateWorkshopItemVdf", () => {
  it("includes the appid and contentfolder", () => {
    const vdf = generateWorkshopItemVdf({ appId: "480", contentFolder: "/build" });
    expect(vdf).toContain('"appid" "480"');
    expect(vdf).toContain('"contentfolder" "/build"');
  });

  it("defaults visibility to public (0)", () => {
    const vdf = generateWorkshopItemVdf({ appId: "480", contentFolder: "/build" });
    expect(vdf).toContain('"visibility" "0"');
  });

  it("uses the given visibility", () => {
    const vdf = generateWorkshopItemVdf({ appId: "480", contentFolder: "/build", visibility: 2 });
    expect(vdf).toContain('"visibility" "2"');
  });

  it("omits publishedfileid for a new item", () => {
    const vdf = generateWorkshopItemVdf({ appId: "480", contentFolder: "/build" });
    expect(vdf).not.toContain("publishedfileid");
  });

  it("includes publishedfileid when updating an existing item", () => {
    const vdf = generateWorkshopItemVdf({ appId: "480", contentFolder: "/build", publishedFileId: "123456" });
    expect(vdf).toContain('"publishedfileid" "123456"');
  });

  it("includes optional fields only when given", () => {
    const withOptional = generateWorkshopItemVdf({
      appId: "480",
      contentFolder: "/build",
      title: "My Mod",
      description: "A great mod",
      changeNote: "Fixed a bug",
      previewFile: "/build/preview.png",
    });
    expect(withOptional).toContain('"title" "My Mod"');
    expect(withOptional).toContain('"description" "A great mod"');
    expect(withOptional).toContain('"changenote" "Fixed a bug"');
    expect(withOptional).toContain('"previewfile" "/build/preview.png"');

    const withoutOptional = generateWorkshopItemVdf({ appId: "480", contentFolder: "/build" });
    expect(withoutOptional).not.toContain("title");
    expect(withoutOptional).not.toContain("description");
    expect(withoutOptional).not.toContain("changenote");
    expect(withoutOptional).not.toContain("previewfile");
  });
});
