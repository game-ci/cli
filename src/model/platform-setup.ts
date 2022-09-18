import { SetupMac, SetupWindows } from '../logic/unity/platform-setup/index.ts';
import { Options } from '../dependencies.ts';

class PlatformSetup {
  static async setup(options: Options) {
    const { hostPlatform } = options;

    if (!hostPlatform) throw new Error('hostPlatform is not defined');

    switch (hostPlatform) {
      case 'win32':
        await SetupWindows.setup(options);
        break;
      case 'darwin':
        await SetupMac.setup(options);
        break;
    }
  }
}

export default PlatformSetup;
