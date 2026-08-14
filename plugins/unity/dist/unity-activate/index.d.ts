/**
 * Exported so this can be invoked in-process (e.g. an npm-package delegation
 * mechanism) as well as as a standalone script (subprocess delegation) — the
 * CLI-to-destination invocation mechanism is still an open decision, see
 * game-ci/roadmap#11 workstream 2. Both options stay viable from this shape.
 */
export declare function run(): Promise<void>;
