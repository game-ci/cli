import type { Options } from '../dependencies.ts';
import { System } from './system/system.ts';
import { UnityBuildValidation } from './unity/build-validation/unity-build-validation.ts';
import { ImageEnvironmentFactory } from './image-environment-factory.ts';
import { UnityEnvironment } from '../logic/unity/environment.ts';

class MacBuilder {
  /**
   * Native mac builds run entrypoint.sh as a plain child process (no Docker
   * --env flags), so parsed CLI options were never actually reaching the
   * build - only vars a user separately exported in their shell mattered.
   * Reuses the same env var set Docker builds already send, this time
   * passed directly via System.run's `env` option.
   */
  private static buildEnv(options: Options): Record<string, string> {
    const { currentWorkDir, cliDistPath } = options;
    const extraVariables = options.engine === 'unity' ? UnityEnvironment.getVariables(options) : [];
    const variables = ImageEnvironmentFactory.getEnvironmentVariables(options, extraVariables);
    const env: Record<string, string> = {};
    for (const { name, value } of variables) {
      if (value === '' || value === undefined) continue;
      env[name] = value.toString();
    }
    // Not part of ImageEnvironmentFactory's set - Docker builds get these via
    // explicit --env flags / volume-mount paths instead; the native mac path
    // needs the real host values since there's no container remapping.
    if (currentWorkDir) env.GITHUB_WORKSPACE = currentWorkDir;
    if (cliDistPath) env.ACTION_FOLDER = cliDistPath;
    return env;
  }

  public static async run(options: Options, silent = false) {
    const { cliDistPath, engine } = options;
    log.warning('running the process');
    const macRun = await System.run(`bash ${cliDistPath}/platforms/mac/entrypoint.sh`, undefined, {
      silent,
      env: MacBuilder.buildEnv(options),
    });

    switch (engine) {
      case 'unity':
        UnityBuildValidation.validateBuild(macRun.output);
        break;
    }
  }
}

export { MacBuilder };
