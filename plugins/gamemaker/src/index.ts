/**
 * GameMaker Studio engine plugin - DRAFT.
 *
 * Plan: detect a GameMaker project via a *.yyp file, and build via
 * GameMaker's official Igor CLI (the same command line tool the Editor
 * itself calls). Igor's actual invocation shape (runtime/license
 * selection quirks, `igor.exe -uf <project> -c <config> -j 8 <verb>`
 * style arguments) needs real verification against a GameMaker install
 * before this is functional - left as TODOs rather than guessed, per
 * this repo's own convention of not shipping unverified domain logic.
 */

export interface GameMakerVersionDetector {
  isGameMakerProject(projectPath: string): boolean;
}

// TODO: detect a .yyp file in projectPath (GameMaker's project manifest).
function isGameMakerProject(_projectPath: string): boolean {
  return false;
}

export const gamemakerPlugin = {
  name: "gamemaker",
  version: "0.0.1",

  engineDetectors: [
    {
      name: "gamemaker",
      detect(projectPath: string) {
        if (isGameMakerProject(projectPath)) {
          // TODO: read the actual GameMaker/Igor version once detection is real.
          return { engine: "gamemaker", engineVersion: "unknown" };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: "gamemaker",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "build") {
          throw new Error(
            "GameMaker build support is not implemented yet (draft plugin). " +
              "See plugins/gamemaker/README.md for the planned Igor CLI invocation shape.",
          );
        }
        return null;
      },
    },
  ],
};

export default gamemakerPlugin;
