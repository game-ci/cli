import { SetupMac, SetupWindows, SetupAndroid } from '../logic/unity/platform-setup/index.ts';
import { fsSync as fs, Options } from '../dependencies.ts';

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

    let servicesConfig = Deno.readTextFileSync(servicesConfigPathTemplate);
    servicesConfig = servicesConfig.replace('%URL%', unityLicensingServer);
    Deno.writeTextFileSync(servicesConfigPath, servicesConfig);

    SetupAndroid.setup(options);
  }
}

export default PlatformSetup;
