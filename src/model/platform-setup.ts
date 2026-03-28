import { SetupMac, SetupWindows, SetupAndroid } from '../logic/unity/platform-setup/index.ts';
import { fsSync as fs } from '../dependencies.ts';
import type { Options } from '../dependencies.ts';
import * as nodeFs from 'node:fs';

class PlatformSetup {
  static async setup(options: Options) {
    const { hostPlatform } = options;

    if (!hostPlatform) throw new Error('hostPlatform is not defined');

    PlatformSetup.SetupShared(options);

    switch (hostPlatform) {
      case 'win32':
        await SetupWindows.setup(options);
        break;
      case 'darwin':
        await SetupMac.setup(options);
        break;
    }
  }

  private static SetupShared(options: Options) {
    const { cliDistPath, unityLicensingServer } = options;
    const servicesConfigPath = `${cliDistPath}/unity-config/services-config.json`;
    const servicesConfigPathTemplate = `${servicesConfigPath}.template`;
    if (!fs.existsSync(servicesConfigPathTemplate)) {
      log.error(`Missing services config ${servicesConfigPathTemplate}`);

      return;
    }

    let servicesConfig = nodeFs.readFileSync(servicesConfigPathTemplate, 'utf-8');
    servicesConfig = servicesConfig.replace('%URL%', unityLicensingServer);
    nodeFs.writeFileSync(servicesConfigPath, servicesConfig);

    SetupAndroid.setup(options);
  }
}

export default PlatformSetup;
