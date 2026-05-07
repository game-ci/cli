import { SetupMac } from './setup-mac.ts';
import { SetupWindows } from './setup-windows.ts';
import { SetupAndroid } from './setup-android.ts';
import { fsSync as fs } from '../../../dependencies.ts';
import type { Options } from '../../../dependencies.ts';
import * as nodeFs from 'node:fs';

/**
 * Unity-scoped platform setup entry point.
 *
 * Lives under `src/logic/unity/` because it is engine-specific:
 *  - Writes Unity's `services-config.json` for floating-license activation
 *  - Dispatches to Unity-specific Mac/Windows/Android setup modules
 *
 * Previously lived at `src/model/platform-setup.ts`, which was an
 * engine-agnostic location. The move enforces cli's intended boundary
 * between engine-agnostic core and engine-scoped extensions.
 *
 * See https://github.com/game-ci/cli/issues/51
 */
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
    const { cliDistPath, unityLicensingServer, unityLicensingToolset } = options;
    const servicesConfigPath = `${cliDistPath}/unity-config/services-config.json`;
    const servicesConfigPathTemplate = `${servicesConfigPath}.template`;
    if (!fs.existsSync(servicesConfigPathTemplate)) {
      log.error(`Missing services config ${servicesConfigPathTemplate}`);

      return;
    }

    let servicesConfig = nodeFs.readFileSync(servicesConfigPathTemplate, 'utf-8');
    servicesConfig = servicesConfig.replace('%URL%', unityLicensingServer);

    if (unityLicensingToolset) {
      const parsed = JSON.parse(servicesConfig);
      parsed.toolset = unityLicensingToolset;
      servicesConfig = JSON.stringify(parsed, undefined, 2);
    }

    nodeFs.writeFileSync(servicesConfigPath, servicesConfig);

    SetupAndroid.setup(options);
  }
}

export { PlatformSetup };
