declare class ImageTag {
    repository: string;
    name: string;
    version: string;
    platform: any;
    builderPlatform: string;
    customImage: any;
    constructor(unityVersion: string);
    static get versionPattern(): RegExp;
    static get imageSuffixes(): {
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
    static getTargetPlatformToImageSuffixMap(platform: any, version: any): string;
    get tag(): string;
    get image(): string;
    toString(): any;
}
export default ImageTag;
