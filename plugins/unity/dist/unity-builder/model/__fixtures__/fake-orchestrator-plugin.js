"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlugin = createPlugin;
// Resolvable stand-in for @game-ci/orchestrator in plugin.test.ts's
// "package installed" tests. @game-ci/orchestrator itself is intentionally
// not a real dependency of this package (see plugin.ts's DEFAULT_PLUGIN_MODULE
// comment) and has no built dist/ in this CI job, so vi.doMock'ing that bare
// specifier directly fails at real module resolution before the mock factory
// ever runs. Mocking this real, on-disk file instead sidesteps that: the
// module identity resolves normally, and the mock factory replaces its
// (otherwise-unused) content.
function createPlugin() {
    throw new Error('createPlugin() from the fixture stub was called unmocked - the test should have overridden it');
}
