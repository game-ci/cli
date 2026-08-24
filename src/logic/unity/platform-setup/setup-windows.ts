import { fsSync as fs } from '../../../dependencies.ts';
import type { Options } from '../../../dependencies.ts';
import { ValidateWindows } from '../platform-validation/validate-windows.ts';
import { System } from '../../../model/system/system.ts';

class SetupWindows {
  public static async setup(options: Options) {
    ValidateWindows.validate(options);
    // Docker.getWindowsCommand mounts `${cliStoragePath}/registry-keys` as a
    // bind volume unconditionally, for every Windows-Docker Unity build
    // regardless of targetPlatform - not just the three platforms that
    // actually need a WinSDK registry export below. Ensuring the directory
    // exists here, unconditionally, keeps that mount from failing with
    // "bind source path does not exist" for every other target platform
    // (e.g. Android, iOS, WebGL) built via Windows Docker.
    this.ensureRegistryKeysDir(options);
    await this.generateWinSdkRegistryKey(options);
  }

  private static ensureRegistryKeysDir(options: Options): string {
    const { cliStoragePath } = options;
    const registryKeysPath = `${cliStoragePath}/registry-keys`;

    fs.ensureDir(registryKeysPath);

    return registryKeysPath;
  }

  private static async generateWinSdkRegistryKey(options: Options) {
    const { targetPlatform, cliStoragePath } = options;

    if (!['StandaloneWindows', 'StandaloneWindows64', 'WSAPlayer'].includes(targetPlatform)) return;

    const registryKeysPath = `${cliStoragePath}/registry-keys`;
    const copyWinSdkRegistryKeyCommand = `reg export "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0" ${registryKeysPath}/winsdk.reg /y`;

    await System.run(copyWinSdkRegistryKeyCommand);
  }
}

export { SetupWindows };
