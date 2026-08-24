/**
 * Pseudo-localization QA plugin - DRAFT.
 *
 * Plan: `game-ci pseudo-localize <projectPath>` injects pseudo-loc
 * strings (accented/expanded characters standing in for real
 * translations) into a project's localization tables pre-translation, so
 * UI overflow/truncation bugs surface before real translation work ever
 * starts. Distinct from a translation-*sync* plugin (pulling/pushing real
 * strings to a vendor) - this is UI testing, not translation management.
 *
 * NOTE: `pseudo-localize` is not yet registered as a core CLI command.
 */

export const pseudoLocalizationPlugin = {
  name: "pseudo-localization",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "pseudo-localize") {
          return {
            name: "Pseudo-localize",
            async configureOptions() {
              // TODO: register --sourceLocale, --expansionFactor, --outputPath.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Pseudo-localization QA is not implemented yet (draft plugin), and `pseudo-localize` " +
                  "is not yet registered as a core command either. See plugins/pseudo-localization/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default pseudoLocalizationPlugin;
