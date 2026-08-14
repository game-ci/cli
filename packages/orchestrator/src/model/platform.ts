/**
 * Bridge file — stub for Platform.
 *
 * Provides platform type constants used in tests and image tag resolution.
 */

class Platform {
  static get default(): string {
    return Platform.types.StandaloneWindows64;
  }

  static get types(): { [key: string]: string } {
    return {
      StandaloneOSX: 'StandaloneOSX',
      StandaloneWindows: 'StandaloneWindows',
      StandaloneWindows64: 'StandaloneWindows64',
      StandaloneLinux64: 'StandaloneLinux64',
      iOS: 'iOS',
      Android: 'Android',
      WebGL: 'WebGL',
      WSAPlayer: 'WSAPlayer',
      PS4: 'PS4',
      XboxOne: 'XboxOne',
      tvOS: 'tvOS',
      VisionOS: 'VisionOS',
      Switch: 'Switch',
      Lumin: 'Lumin',
      BJM: 'BJM',
      Stadia: 'Stadia',
      Facebook: 'Facebook',
      NoTarget: 'NoTarget',
      Test: 'Test',
    };
  }

  static isWindows(platform: string): boolean {
    return platform === 'StandaloneWindows' || platform === 'StandaloneWindows64';
  }

  static isAndroid(platform: string): boolean {
    return platform === 'Android';
  }
}

export default Platform;
export { Platform };
