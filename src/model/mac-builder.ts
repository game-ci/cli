import { Options } from '../dependencies.ts';
import System from './system/system.ts';
import UnityBuildValidation from "./unity/build-validation/unity-build-validation.ts";

class MacBuilder {
  public static async run(options: Options, silent = false) {
    const { cliDistPath, engine } = options;
    log.warning('running the process');
    const macRun = await System.run(`bash ${cliDistPath}/platforms/mac/entrypoint.sh`, { silent });

    switch (engine)
      {
        case 'unity':
          UnityBuildValidation.validateBuild(macRun.output);
          break;
      }
  }
}

export default MacBuilder;
