/**
 * Bridge file — stub for ImageTag.
 *
 * Used by orchestrator to build Docker image references from
 * BuildParameters properties.
 */

class ImageTag {
  public repository: string;
  public editorVersion: string;
  public targetPlatform: string;
  public builderPlatform: string;
  public customImage: string;
  public imageRollingVersion: number;
  public imagePlatformPrefix: string;

  constructor(imageProperties: { [key: string]: string }) {
    const {
      editorVersion = '',
      targetPlatform = '',
      builderPlatform = '',
      customImage = '',
    } = imageProperties;

    // Real bug (game-ci/cli#248): several call sites built the overrides
    // object passed into BuildParameters.create() with
    // `unityVersion: UnityVersioning.determineUnityVersion(...)` - an async
    // function - without awaiting it. The unresolved Promise flowed through
    // untyped `{ [key: string]: string }` properties all the way here and
    // got silently stringified as "[object Promise]" inside the Docker image
    // tag (e.g. `unityci/editor:[object Promise]-linux-il2cpp-3`), which
    // then failed to pull with no indication of the real cause. Fail loudly
    // at the point the bad value is actually consumed, rather than let it
    // travel further as a corrupted tag string.
    if (editorVersion !== '' && typeof (editorVersion as unknown as { then?: unknown })?.then === 'function') {
      throw new TypeError(
        'ImageTag received a Promise for editorVersion instead of a resolved string - ' +
          'a caller almost certainly forgot to `await` an async Unity-version lookup ' +
          '(e.g. UnityVersioning.determineUnityVersion) before building these parameters.',
      );
    }

    this.repository = 'unityci';
    this.editorVersion = editorVersion;
    this.targetPlatform = targetPlatform;
    this.builderPlatform = builderPlatform;
    this.customImage = customImage;
    this.imageRollingVersion = 3;
    this.imagePlatformPrefix = ImageTag.getImagePlatformPrefixes(builderPlatform);
  }

  static get versionPattern(): RegExp {
    return /^\d+\.\d+\.\d+[a-z]\d+$/;
  }

  static get targetPlatformSuffixes(): { [key: string]: string } {
    return {
      StandaloneOSX: 'mac-mono',
      StandaloneWindows: 'windows-mono',
      StandaloneWindows64: 'windows-mono',
      StandaloneLinux64: 'linux-il2cpp',
      iOS: 'ios',
      Android: 'android',
      WebGL: 'webgl',
    };
  }

  static getImagePlatformPrefixes(platform: string): string {
    switch (platform) {
      case 'linux':
        return '';
      case 'win32':
        return 'windows-';
      case 'darwin':
        return 'mac-';
      default:
        return '';
    }
  }

  static getTargetPlatformToTargetPlatformSuffixMap(
    platform: string,
    _version: string,
    _providerStrategy: string,
  ): string {
    return ImageTag.targetPlatformSuffixes[platform] || platform.toLowerCase();
  }

  get tag(): string {
    // Use the targetPlatformSuffixes lookup so the tag matches the actual
    // image names published on Docker Hub (e.g. `unityci/editor:6000.4.7f1-
    // windows-mono-3`). Previously this returned `${this.targetPlatform}`
    // directly, producing tags like `unityci/editor:6000.4.7f1-
    // StandaloneWindows64-3` that do not exist upstream, so `docker pull`
    // failed with exit code 125 on every local-docker provider invocation
    // (downstream frostebite/GameClient run 25995914040, 2026-05-17).
    // Falls back to lowercased platform if no mapping is registered, matching
    // the behaviour of `getTargetPlatformToTargetPlatformSuffixMap`.
    const platformSuffix =
      ImageTag.targetPlatformSuffixes[this.targetPlatform] || this.targetPlatform.toLowerCase();
    return `${this.editorVersion}-${platformSuffix}-${this.imageRollingVersion}`;
  }

  get image(): string {
    return `${this.repository}/${this.imagePlatformPrefix}editor`;
  }

  toString(): string {
    if (this.customImage) return this.customImage;

    return `${this.image}:${this.tag}`;
  }
}

export default ImageTag;
export { ImageTag };
