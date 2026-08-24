import * as core from "@actions/core";
import { Action, BuildParameters, Cache, Docker, ImageTag, Output } from "./model";
import MacBuilder from "./model/mac-builder";
import PlatformSetup from "./model/platform-setup";
import { Plugin, loadPlugin } from "./model/plugin";

// Exported so tests can drive the lifecycle directly without depending on
// vitest's module re-loading (which changed in vitest 4).
export async function runMain() {
  try {
    Action.checkCompatibility();
    Cache.verify();

    const { workspace, actionFolder } = Action;
    const buildParameters = await BuildParameters.create();
    const baseImage = new ImageTag(buildParameters);

    // Load optional plugin. The default implementation is @game-ci/orchestrator.
    const plugin = await loadPlugin();
    await plugin?.initialize(buildParameters, workspace);

    let exitCode = -1;

    if (plugin?.canHandleBuild()) {
      // Plugin handles the build entirely (remote providers, hot runner, test workflows)
      const result = await plugin.handleBuild(baseImage.toString());

      exitCode = result.fallbackToLocal
        ? await runLocalBuild(buildParameters, baseImage, workspace, actionFolder, plugin)
        : result.exitCode;
    } else if (buildParameters.providerStrategy === "local") {
      exitCode = await runLocalBuild(buildParameters, baseImage, workspace, actionFolder, plugin);
    } else {
      throw new Error(
        `Provider strategy "${buildParameters.providerStrategy}" requires @game-ci/orchestrator. ` +
          "Install it via the game-ci/orchestrator action, or use providerStrategy=local.",
      );
    }

    // Set core outputs
    await Output.setBuildVersion(buildParameters.buildVersion);
    await Output.setAndroidVersionCode(buildParameters.androidVersionCode);
    await Output.setEngineExitCode(exitCode);

    // Plugin handles post-build (artifacts, archiving, retention)
    await plugin?.handlePostBuild(exitCode);

    if (exitCode !== 0) {
      core.setFailed(`Build failed with exit code ${exitCode}`);
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

async function runLocalBuild(
  buildParameters: BuildParameters,
  baseImage: ImageTag,
  workspace: string,
  actionFolder: string,
  plugin?: Plugin,
): Promise<number> {
  // beforeLocalBuild() may have restored the local cache via a filesystem MOVE
  // (localCacheMode=move-directory), which removes it from the cache root rather
  // than copying it. afterLocalBuild() must always run to move the cache back,
  // even when setup/build throws instead of returning an exit code -- otherwise
  // the cache is lost with no surviving copy anywhere. See plugins/orchestrator
  // LocalCacheService / ChildWorkspaceService for the move-based cache services.
  let exitCode = -1;
  let buildError: unknown;
  try {
    await plugin?.beforeLocalBuild(workspace);
    await PlatformSetup.setup(buildParameters, actionFolder);
    exitCode =
      process.platform === "darwin"
        ? await MacBuilder.run(actionFolder)
        : await Docker.run(baseImage.toString(), {
            workspace,
            actionFolder,
            ...buildParameters,
          });
  } catch (error) {
    buildError = error;
    throw error;
  } finally {
    try {
      await plugin?.afterLocalBuild(workspace, exitCode);
    } catch (afterBuildError) {
      if (buildError) {
        // Preserve the primary setup/build failure while still surfacing the
        // independent cleanup failure in the log.
        core.warning(`afterLocalBuild failed: ${(afterBuildError as Error).message ?? afterBuildError}`);
      } else {
        // A successful build with a failed move-directory save-back can leave
        // the cache without a durable copy. Treat that as a real failure.
        throw afterBuildError;
      }
    }
  }

  return exitCode;
}

// Only auto-run when executed directly (subprocess/script invocation), not
// when imported as a library by a thin-wrapper action repo (which calls
// runMain() explicitly) — see game-ci/roadmap#11 workstream 2.
if (require.main === module) {
  runMain();
}
