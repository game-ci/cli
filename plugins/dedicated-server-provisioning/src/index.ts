/**
 * Dedicated Server Provisioning plugin - DRAFT.
 *
 * Plan: `game-ci provision-server <buildPath>` generates the "stand this
 * up" artifacts for self-hosters - docker-compose/systemd units,
 * firewall/port config, a health-check endpoint - complementing (not
 * duplicating) a separate dedicated-server *build* step that strips
 * client-only assets and packages a headless binary.
 *
 * NOTE: `provision-server` is not yet registered as a core CLI command.
 */

export const dedicatedServerProvisioningPlugin = {
  name: "dedicated-server-provisioning",
  version: "0.0.1",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "provision-server") {
          return {
            name: "Provision server",
            async configureOptions() {
              // TODO: register --port, --healthCheckPath, --composeOutputPath, etc.
            },
            async execute(): Promise<boolean> {
              throw new Error(
                "Dedicated Server Provisioning is not implemented yet (draft plugin), and " +
                  "`provision-server` is not yet registered as a core command either. See plugins/dedicated-server-provisioning/README.md.",
              );
            },
          };
        }
        return null;
      },
    },
  ],
};

export default dedicatedServerProvisioningPlugin;
