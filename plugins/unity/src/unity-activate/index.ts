import * as core from '@actions/core';
import { Action, Docker, ImageTag, Input } from './model';

/**
 * Exported so this can be invoked in-process (e.g. an npm-package delegation
 * mechanism) as well as as a standalone script (subprocess delegation) — the
 * CLI-to-destination invocation mechanism is still an open decision, see
 * game-ci/roadmap#11 workstream 2. Both options stay viable from this shape.
 */
export async function run() {
  try {
    Action.checkCompatibility();

    const { dockerfile, workspace, actionFolder } = Action;
    const unityVersion = Input.unityVersion;
    const baseImage = new ImageTag(unityVersion);

    // Build docker image
    const actionImage = await Docker.build({ path: actionFolder, dockerfile, baseImage });

    // Run docker image
    await Docker.run(actionImage, { workspace, unityVersion });
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

// Only auto-run when executed directly (subprocess/script invocation),
// not when imported as a library (in-process invocation).
if (require.main === module) {
  run();
}
