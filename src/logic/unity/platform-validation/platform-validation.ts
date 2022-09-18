import { Options } from '../../../dependencies.ts';

export class PlatformValidation {
  private static get supportedPlatforms() {
    return ['linux', 'win32', 'darwin'];
  }

  public static checkCompatibility(options: Options) {
    const { hostPlatform, hostOS } = options;

    if (!PlatformValidation.supportedPlatforms.includes(hostPlatform)) {
      throw new Error(`Currently ${hostOS} (${hostPlatform}) is not supported`);
    }
  }
}
