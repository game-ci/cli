import { fsSync as fs, Options } from '../../../dependencies.ts';
import ValidateWindows from '../platform-validation/validate-windows.ts';
import System from '../../../model/system/system.ts';

class SetupWindows {
  public static async setup(options: Options) {
    ValidateWindows.validate(options);
    await this.generateWinSdkRegistryKey(options);
  }

  private static async generateWinSdkRegistryKey(options: Options) {
    const { targetPlatform, cliStoragePath } = options;

    if (!['StandaloneWindows', 'StandaloneWindows64', 'WSAPlayer'].includes(targetPlatform)) return;

    const registryKeysPath = `${cliStoragePath}/registry-keys`;
    const copyWinSdkRegistryKeyCommand = `reg export "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0" ${registryKeysPath}/winsdk.reg /y`;

    await fs.ensureDir(registryKeysPath);
    await System.run(copyWinSdkRegistryKeyCommand);
  }
}

export default SetupWindows;
