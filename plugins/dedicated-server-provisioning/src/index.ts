/**
 * Dedicated Server Provisioning plugin - DRAFT.
 *
 * The generators in ./dedicated-server-provisioner.ts are real and tested:
 * docker-compose, a systemd unit, and ufw firewall rules from a typed
 * config. They are pure functions - nothing is written to disk and nothing
 * is executed, so a generator bug cannot mutate a real host.
 *
 * What's still missing before `provision-server` is a real command:
 * writing the generated files to the right place in a build's output, and
 * registering `provision-server` in core's CliCommands so this plugin's
 * dispatch is ever reached at all.
 */

export {
  generateDockerCompose,
  generateSystemdUnit,
  generateFirewallRules,
} from './dedicated-server-provisioner';
export type {
  DedicatedServerConfig,
  ServerPort,
} from './dedicated-server-provisioner';

export const dedicatedServerProvisioningPlugin = {
  name: 'dedicated-server-provisioning',
  version: '0.0.1',

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      '[game-ci] WARNING: @game-ci/dedicated-server-provisioning is an EXPERIMENTAL draft ' +
        'plugin. Its structure is real but its domain logic is not implemented - any command ' +
        'it claims will throw. Do not depend on it. See ' +
        'plugins/dedicated-server-provisioning/README.md.',
    );
  },

  commands: [
    {
      engine: '*',
      createCommand(command: string, _subCommands: string[]) {
        if (command === 'provision-server') {
          throw new Error(
            'dedicated-server-provisioning: `provision-server` is not implemented yet (draft ' +
              "plugin), and is not yet registered in core's CliCommands either - this dispatch " +
              'entry is unreachable until both land. See plugins/dedicated-server-provisioning/README.md.',
          );
        }
        return null;
      },
    },
  ],
};

export default dedicatedServerProvisioningPlugin;
