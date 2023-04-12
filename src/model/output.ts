import { core } from '../dependencies.ts';

class Output {
  static setBuildVersion(buildVersion: string) {
    core.setOutput('buildVersion', buildVersion);
  }

  static setAndroidVersionCode(androidVersionCode: string) {
    core.setOutput('androidVersionCode', androidVersionCode);
  }
}

export default Output;
