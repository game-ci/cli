declare class ImageTag {
    customImage?: string;
    repository: string;
    editorVersion: string;
    targetPlatform: string;
    targetPlatformSuffix: string;
    imagePlatformPrefix: string;
    imageRollingVersion: number;
    constructor(imageProperties: any);
    static get versionPattern(): RegExp;
    static get targetPlatformSuffixes(): {
        generic: string;
        webgl: string;
        mac: string;
        windows: string;
        linux: string;
        linuxIl2cpp: string;
        android: string;
        ios: string;
        facebook: string;
    };
    static getImagePlatformPrefix(platform: any): "ubuntu" | "windows";
    static getImagePlatformType(platform: any): string;
    static getTargetPlatformSuffix(targetPlatform: any, editorVersion: any): string;
    get tag(): string;
    get image(): string;
    toString(): string;
}
export default ImageTag;
