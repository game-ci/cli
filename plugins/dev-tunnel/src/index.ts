/**
 * Dev Tunnel & Service Directory plugin - DRAFT.
 *
 * Plan: `game-ci tunnel --target <port>` sets up nginx/Caddy local named
 * routing for whatever's running locally, exposes it via a Cloudflare
 * *quick* tunnel (testing-only by Cloudflare's own documentation - no
 * SLA, not for production/sustained use - see plugins/dev-tunnel/README.md),
 * and publishes the resolved URL via one of two explicit modes:
 * --publish=pages (GitHub Pages - public by default, even from a private
 * repo, unless the org is on GitHub Enterprise Cloud) or
 * --publish=private-remote (rclone/webhook, access-controlled). The two
 * modes are explicit and separate on purpose, so a live dev endpoint is
 * never silently made public.
 *
 * NOTE: `tunnel` is not yet registered as a core CLI command.
 */

export const devTunnelPlugin = {
  name: "dev-tunnel",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "tunnel") {
          return {
            name: "Dev tunnel",
            async configureOptions() {
              // TODO: register --target (port), --routes (nginx/Caddy named-route config),
              // --publish (pages|private-remote), and the publish-target-specific options.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Dev Tunnel & Service Directory is not implemented yet (draft plugin), and `tunnel` " +
                  "is not yet registered as a core command either. See plugins/dev-tunnel/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default devTunnelPlugin;
