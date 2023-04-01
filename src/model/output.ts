import { core } from '../dependencies.ts';

class Output {
  static setBuildVersion(buildVersion: string) {
    core.setOutput('buildVersion', buildVersion);
  }
}

export default Output;
