/**
 * Screen Capture and Visual Regression plugin - DRAFT.
 *
 * The comparison logic in ./visual-baseline.ts is real and tested: it
 * digests every image under a directory and compares it against a baseline
 * set by content hash. That deliberately does NOT do perceptual/threshold
 * diffing - a one-pixel antialiasing change and a completely different
 * frame both read as "changed". Perceptual diffing needs a real image
 * codec and a tuned threshold; pretending to do it with a byte hash would
 * be worse than not offering it.
 *
 * What's still missing before `capture` is a real command: the capture
 * step itself (driving the built player to take the screenshots in the
 * first place - platform/engine-specific) and registering `capture` in
 * core's CliCommands so this plugin's dispatch is ever reached at all.
 */

export {
  compareVisualCaptures,
  digestDirectory,
  summarizeVisualComparison,
} from './visual-baseline';
export type {
  VisualChangeKind,
  VisualComparisonEntry,
  VisualComparisonResult,
  DigestDirectoryOptions,
} from './visual-baseline';

export const screenCapturePlugin = {
  name: 'screen-capture',
  version: '0.0.1',

  /**
   * Loaded only via an explicit --plugin flag, never by default, so
   * reaching this point is deliberate - warn rather than fail, but make
   * it impossible to mistake for a working integration.
   */
  onLoad() {
    console.warn(
      '[game-ci] WARNING: @game-ci/screen-capture is an EXPERIMENTAL draft plugin. ' +
        'Its structure is real but its domain logic is not implemented - any command it ' +
        'claims will throw. Do not depend on it. See plugins/screen-capture/README.md.',
    );
  },

  commands: [
    {
      engine: '*',
      createCommand(command: string, _subCommands: string[]) {
        if (command === 'capture') {
          throw new Error(
            'screen-capture: `capture` is not implemented yet (draft plugin), and is not yet ' +
              "registered in core's CliCommands either - this dispatch entry is unreachable until " +
              'both land. See plugins/screen-capture/README.md.',
          );
        }
        return null;
      },
    },
  ],
};

export default screenCapturePlugin;
