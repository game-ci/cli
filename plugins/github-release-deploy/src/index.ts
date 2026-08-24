/**
 * GitHub/GitLab Release deploy plugin - DRAFT.
 *
 * Plan: `game-ci deploy github-release <buildPath> --repo --tag` attaches
 * built artifacts to a GitHub or GitLab Release - a deploy target for
 * games distributed outside Steam/itch (open-source games, internal
 * builds, anything shipped straight from a repo). Handles multi-platform
 * artifact naming/organization the way a game build specifically
 * produces it, rather than being a bare file-upload wrapper.
 *
 * NOTE: mirrors steam-deploy's `deploy <target>` dispatch shape (already
 * registered in core - see game-ci/cli#123).
 */

export const githubReleaseDeployPlugin = {
  name: "github-release-deploy",
  version: "0.0.1",

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      "[game-ci] WARNING: @game-ci/github-release-deploy is an EXPERIMENTAL draft plugin. " +
        "Its structure is real but its domain logic is not implemented - any command it " +
        "claims will throw. Do not depend on it. See plugins/github-release-deploy/README.md.",
    );
  },

  commands: [
    {
      engine: "*",
      createCommand(command: string, subCommands: string[]) {
        if (command === "deploy" && subCommands[0] === "github-release") {
          return {
            name: "Deploy github release",
            async configureOptions() {
              // TODO: register --repo, --tag, --releaseNotes, --draft, --prerelease.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "GitHub Release deploy is not implemented yet (draft plugin). " +
                  "See plugins/github-release-deploy/README.md for the planned approach.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default githubReleaseDeployPlugin;
