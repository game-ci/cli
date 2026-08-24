/**
 * Code-signing and notarization plugin - DRAFT.
 *
 * Plan: `game-ci sign <buildPath> --platform macos|windows` signs (and,
 * on macOS, notarizes and staples) a built player. Real, common pain
 * point: an unsigned macOS build is blocked by Gatekeeper, an unsigned
 * Windows build is flagged by SmartScreen. Genuinely complex enough
 * (credential/certificate management, async notarization ticket polling
 * on macOS) to deserve dedicated code rather than a shell snippet.
 *
 * NOTE: `sign` is not yet registered as a core CLI command.
 */

export const codeSigningPlugin = {
  name: "code-signing",
  version: "0.0.1",

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      "[game-ci] WARNING: @game-ci/code-signing is an EXPERIMENTAL draft plugin. " +
        "Its structure is real but its domain logic is not implemented - any command it " +
        "claims will throw. Do not depend on it. See plugins/code-signing/README.md.",
    );
  },

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "sign") {
          return {
            name: "Sign build",
            async configureOptions() {
              // TODO: register --platform (macos|windows), --identity/--certificate,
              // --notarize (macOS, default true when --platform=macos), --timeout.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Code-signing / notarization is not implemented yet (draft plugin), and `sign` " +
                  "is not yet registered as a core command either. See plugins/code-signing/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default codeSigningPlugin;
