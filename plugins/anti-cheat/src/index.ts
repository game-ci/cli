/**
 * Anti-cheat / build-integrity plugin - DRAFT.
 *
 * Plan: unlike the other plugins in this batch, this isn't a new
 * top-level command - it's an *options* plugin (engine: '*', matching
 * PluginRegistry.configureOptions' existing wildcard handling) that
 * wraps EasyAntiCheat/BattlEye SDK integration into whatever build
 * command already runs (build/orchestrate), adding options like
 * --enableAntiCheat and --eacGameId. No command dispatch is needed here;
 * the actual SDK integration is inherently build-process-level (signing,
 * binary wrapping), not a separate verb.
 */

export const antiCheatPlugin = {
  name: "anti-cheat",
  version: "0.0.1",

  options: [
    {
      engine: "*",
      async configure(_yargs: unknown) {
        // TODO: register --enableAntiCheat, --antiCheatProvider (eac|battleye),
        // --eacGameId/--battleyeGameId, matching game-ci's convention of
        // opt-in flags defaulting off for a real behavior change.
      },
    },
  ],

  // TODO: this plugin needs a real integration point into the build
  // lifecycle (likely a post-build hook, once this plugin can register
  // one - see plugins/orchestrator's middleware/hooks system for the
  // existing pattern) to actually wrap the built binary with the chosen
  // anti-cheat SDK. Throwing here documents that this isn't wired yet,
  // rather than silently doing nothing.
  async onLoad() {
    console.warn(
      "@game-ci/anti-cheat is a draft plugin - it registers options but does not yet wrap any build output. See plugins/anti-cheat/README.md.",
    );
  },
};

export default antiCheatPlugin;
