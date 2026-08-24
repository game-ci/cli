/**
 * Ren'Py engine plugin - DRAFT.
 *
 * Plan: detect a Ren'Py project via its game/ folder plus a game/*.rpy
 * script, and build via Ren'Py's own `renpy.exe <project> distribute`
 * command (a real CLI Ren'Py ships), which produces per-platform
 * distribution archives. Needs verification against Ren'Py's actual
 * distribute output structure before this is functional.
 */

function isRenpyProject(_projectPath: string): boolean {
  // TODO: check for a game/ folder containing at least one *.rpy file.
  return false;
}

export const renpyPlugin = {
  name: "renpy",
  version: "0.0.1",

  engineDetectors: [
    {
      name: "renpy",
      detect(projectPath: string) {
        if (isRenpyProject(projectPath)) {
          // TODO: read the actual Ren'Py SDK version this project was built with.
          return { engine: "renpy", engineVersion: "unknown" };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: "renpy",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "build") {
          throw new Error(
            "Ren'Py build support is not implemented yet (draft plugin). " +
              "See plugins/renpy/README.md for the planned `renpy.exe distribute` invocation.",
          );
        }
        return null;
      },
    },
  ],
};

export default renpyPlugin;
