class UnityTargetPlatform {
  public static readonly Android = 'Android';
  public static readonly iOS = 'iOS';
  public static readonly StandaloneLinux64 = 'StandaloneLinux64';
  public static readonly StandaloneOSX = 'StandaloneOSX';
  public static readonly StandaloneWindows = 'StandaloneWindows';
  public static readonly StandaloneWindows64 = 'StandaloneWindows64';
  public static readonly Switch = 'Switch';
  public static readonly tvOS = 'tvOS';
  public static readonly WebGL = 'WebGL';
  public static readonly WSAPlayer = 'WSAPlayer';
  public static readonly XboxOne = 'XboxOne';
  public static readonly PS4 = 'PS4';

  // Unsupported
  public static readonly Lumin = 'Lumin';
  public static readonly BJM = 'BJM';
  public static readonly Stadia = 'Stadia';
  public static readonly Facebook = 'Facebook';
  public static readonly NoTarget = 'NoTarget';

  // Test specific
  public static readonly Test = 'Test';

  static get default() {
    return UnityTargetPlatform.StandaloneWindows64;
  }

  static isWindows(platform: string) {
    switch (platform) {
      case UnityTargetPlatform.StandaloneWindows:
      case UnityTargetPlatform.StandaloneWindows64:
        return true;
      default:
        return false;
    }
  }

  static isAndroid(platform: string) {
    switch (platform) {
      case UnityTargetPlatform.Android:
        return true;
      default:
        return false;
    }
  }

  static determineBuildFileName(buildName: string, platform: string, androidExportType: string) {
    if (UnityTargetPlatform.isWindows(platform)) {
      return `${buildName}.exe`;
    }

    if (UnityTargetPlatform.isAndroid(platform)) {
      switch (androidExportType) {
        case 'androidPackage':
          return `${buildName}.apk`;
        case 'androidAppBundle':
          return `${buildName}.aab`;
        case 'androidStudioProject':
          return `${buildName}`;
      }
    }

    return buildName;
  }
}

export default UnityTargetPlatform;
