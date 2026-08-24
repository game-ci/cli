/**
 * RPG Maker (MV/MZ) engine plugin - DRAFT.
 *
 * Plan: detect an RPG Maker project via its data folder structure
 * (data/System.json plus a www/ or js/ folder, depending on MV vs MZ),
 * and build by packaging the project through NW.js per-platform, since
 * RPG Maker has no official build CLI of its own - export is normally a
 * manual Editor step. This is the fiddliest of the new engine plugins and
 * needs real verification against the actual NW.js packaging structure
 * before it's functional.
 */

function isRpgMakerProject(_projectPath: string): boolean {
  // TODO: check for data/System.json plus MV's www/ or MZ's js/ folder.
  return false;
}

export const rpgMakerPlugin = {
  name: "rpg-maker",
  version: "0.0.1",

  engineDetectors: [
    {
      name: "rpg-maker",
      detect(projectPath: string) {
        if (isRpgMakerProject(projectPath)) {
          // TODO: distinguish MV vs MZ, and read the actual RPG Maker version.
          return { engine: "rpg-maker", engineVersion: "unknown" };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: "rpg-maker",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "build") {
          throw new Error(
            "RPG Maker build support is not implemented yet (draft plugin). " +
              "See plugins/rpg-maker/README.md for the planned NW.js packaging approach.",
          );
        }
        return null;
      },
    },
  ],
};

export default rpgMakerPlugin;
