import System from './system/system.ts';

class MacBuilder {
  public static async run(actionFolder: string) {
    log.warning('running the process');
    await System.run(`bash ${actionFolder}/platforms/mac/entrypoint.sh`);
  }
}

export default MacBuilder;
