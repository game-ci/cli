import { GithubReleaseDeployCommand } from "./github-release-deploy-command";

/**
 * GitHub Release deploy plugin - `game-ci deploy github-release <buildPath>`.
 *
 * Engine-agnostic: it uploads a pre-built output (file or directory), so
 * it doesn't matter whether Unity, Godot, Unreal, or anything else
 * produced it. Registered with engine: '*' (see PluginRegistry.createCommand's
 * wildcard handling), mirroring steam-deploy's dispatch shape.
 *
 * GitLab Release support was scoped out of this first version (see
 * README's "Remaining work" - GitHub first, given this repo's own
 * hosting); the command/option shape doesn't preclude adding it later
 * behind a --provider flag without a breaking change.
 */
export const githubReleaseDeployPlugin = {
  name: "github-release-deploy",
  version: "0.1.0",

  commands: [
    {
      engine: "*",
      createCommand(command: string, subCommands: string[]) {
        if (command === "deploy" && subCommands[0] === "github-release") {
          // Warned here rather than in onLoad: onLoad fires for every
          // command (this plugin is registered by default, see cli.ts's
          // loadPlugins), so warning there would fire even for someone
          // just inspecting `--help` output or running an unrelated
          // command. This fires exactly when the experimental feature is
          // actually used.
          console.warn(
            "[game-ci] WARNING: `deploy github-release` is EXPERIMENTAL. " +
              "Verify against a test repo before pointing it at a real release.",
          );
          return new GithubReleaseDeployCommand();
        }
        return null;
      },
    },
  ],
};

export default githubReleaseDeployPlugin;
export { GithubReleaseDeployCommand } from "./github-release-deploy-command";
export {
  getReleaseByTag,
  createRelease,
  deleteAsset,
  uploadAsset,
  stripUploadUrlTemplate,
} from "./github-api";
