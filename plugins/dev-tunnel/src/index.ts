/**
 * Dev Tunnel and Service Directory plugin - DRAFT.
 *
 * ./service-directory.ts is real and tested: a registry for exposed job
 * endpoints, with the disclosure rules as the actual content. Visibility
 * is explicit per service and defaults are never assumed, because an
 * ephemeral tunnel URL is an unauthenticated entry point into a machine
 * that is often mid-build with source and credentials on disk, and CI logs
 * are frequently public or archived. `formatForLog` redacts the whole
 * private URL, not just its host - a tunnel's random subdomain IS the
 * secret, so partial masking would still leak it.
 *
 * It does not start tunnels itself. What's still missing before `tunnel`
 * is a real command: actually launching nginx/Caddy local routing plus a
 * Cloudflare quick tunnel and registering the resolved URL here, and
 * registering `tunnel` in core's CliCommands so this plugin's dispatch is
 * ever reached at all.
 */

export { ServiceDirectory, ServiceDirectoryError } from './service-directory';
export type { ServiceEntry, ServiceVisibility } from './service-directory';

export const devTunnelPlugin = {
  name: 'dev-tunnel',
  version: '0.0.1',

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      '[game-ci] WARNING: @game-ci/dev-tunnel is an EXPERIMENTAL draft plugin. ' +
        'Its structure is real but its domain logic is not implemented - any command it ' +
        'claims will throw. Do not depend on it. See plugins/dev-tunnel/README.md.',
    );
  },

  commands: [
    {
      engine: '*',
      createCommand(command: string, _subCommands: string[]) {
        if (command === 'tunnel') {
          throw new Error(
            "dev-tunnel: `tunnel` is not implemented yet (draft plugin), and is not yet registered " +
              "in core's CliCommands either - this dispatch entry is unreachable until both land. " +
              'See plugins/dev-tunnel/README.md.',
          );
        }
        return null;
      },
    },
  ],
};

export default devTunnelPlugin;
