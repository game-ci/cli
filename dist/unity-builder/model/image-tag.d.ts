declare class ImageTag {
    repository: string;
    editorVersion: string;
    targetPlatform: string;
    builderPlatform: string;
    customImage: string;
    imageRollingVersion: number;
    imagePlatformPrefix: string;
    constructor(imageProperties: {
        [key: string]: string;
    });
    static get versionPattern(): RegExp;
    static get targetPlatformSuffixes(): {
        generic: string;
        webgl: string;
        mac: string;
        windows: string;
        windowsIl2cpp: string;
        wsaPlayer: string;
        linux: string;
        linuxIl2cpp: string;
        android: string;
        ios: string;
        tvos: string;
        visionos: string;
        facebook: string;
    };
    static getImagePlatformPrefixes(platform: string): string;
    static getTargetPlatformToTargetPlatformSuffixMap(platform: string, version: string, providerStrategy: string): string;
    get tag(): string;
    get image(): string;
    toString(): string;
}
export default ImageTag;
