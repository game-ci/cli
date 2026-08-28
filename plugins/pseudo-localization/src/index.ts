import { PseudoLocalizeCommand } from "./pseudo-localize-command";

/**
 * Pseudo-localization QA plugin - `game-ci pseudo-localize <projectPath>`.
 *
 * Engine-agnostic: operates on a flat localization table file, not an
 * engine project structure, so it doesn't matter what engine produced
 * the project - registered with engine: '*' (see
 * PluginRegistry.createCommand's wildcard handling), same as
 * steam-deploy/github-release-deploy's `deploy` dispatch and
 * test-runtime. Requires `pseudo-localize` to be registered in core's
 * CliCommands/CommandFactory as an engine-independent top-level command
 * (mirrors test-runtime's registration).
 */
export const pseudoLocalizationPlugin = {
  name: "pseudo-localization",
  version: "0.1.0",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "pseudo-localize") {
          return new PseudoLocalizeCommand();
        }
        return null;
      },
    },
  ],
};

export default pseudoLocalizationPlugin;
export { PseudoLocalizeCommand } from "./pseudo-localize-command";
export { pseudoLocalize } from "./pseudo-loc-transform";
export { detectFormat, parseTable, serializeTable } from "./localization-table";
