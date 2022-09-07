export class PlatformValidation {
  private static get supportedPlatforms() {
    return ['linux', 'win32', 'darwin'];
  }

  public static checkCompatibility(options) {
    const { hostPlatform } = options;

    if (!PlatformValidation.supportedPlatforms.includes(hostPlatform)) {
      throw new Error(`Currently ${hostPlatform}-platform is not supported`);
    }
  }
}
