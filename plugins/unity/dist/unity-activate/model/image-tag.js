"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = __importDefault(require("./platform"));
class ImageTag {
    repository;
    name;
    version;
    platform;
    builderPlatform;
    customImage;
    constructor(unityVersion) {
        if (!ImageTag.versionPattern.test(unityVersion)) {
            throw new Error(`Invalid version "${unityVersion}".`);
        }
        const builderPlatform = ImageTag.getTargetPlatformToImageSuffixMap(platform_1.default.types.StandaloneLinux64, unityVersion);
        this.repository = 'unityci';
        this.name = 'editor';
        this.version = unityVersion;
        this.platform = platform_1.default.types.StandaloneLinux64;
        this.builderPlatform = builderPlatform;
        this.customImage = '';
    }
    static get versionPattern() {
        return /^(20|60)\d{2}\.\d\.\w{3,4}|3$/;
    }
    static get imageSuffixes() {
        return {
            generic: '',
            webgl: 'webgl',
            mac: 'mac-mono',
            windows: 'windows-mono',
            linux: 'base',
            linuxIl2cpp: 'linux-il2cpp',
            android: 'android',
            ios: 'ios',
            facebook: 'facebook',
        };
    }
    static getTargetPlatformToImageSuffixMap(platform, version) {
        const { generic, webgl, mac, windows, linux, linuxIl2cpp, android, ios, facebook } = ImageTag.imageSuffixes;
        const [major, minor] = version.split('.').map((digit) => Number(digit));
        // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
        switch (platform) {
            case platform_1.default.types.StandaloneOSX:
                return mac;
            case platform_1.default.types.StandaloneWindows:
                return windows;
            case platform_1.default.types.StandaloneWindows64:
                return windows;
            case platform_1.default.types.StandaloneLinux64: {
                // Unity versions before 2019.3 do not support il2cpp
                if (major >= 2020 || (major === 2019 && minor >= 3)) {
                    return linuxIl2cpp;
                }
                return linux;
            }
            case platform_1.default.types.iOS:
                return ios;
            case platform_1.default.types.Android:
                return android;
            case platform_1.default.types.WebGL:
                return webgl;
            case platform_1.default.types.WSAPlayer:
                return windows;
            case platform_1.default.types.PS4:
                return windows;
            case platform_1.default.types.XboxOne:
                return windows;
            case platform_1.default.types.tvOS:
                return windows;
            case platform_1.default.types.Switch:
                return windows;
            // Unsupported
            case platform_1.default.types.Lumin:
                return windows;
            case platform_1.default.types.BJM:
                return windows;
            case platform_1.default.types.Stadia:
                return windows;
            case platform_1.default.types.Facebook:
                return facebook;
            case platform_1.default.types.NoTarget:
                return generic;
            // Test specific
            case platform_1.default.types.Test:
                return generic;
            default:
                throw new Error(`
          Platform must be one of the ones described in the documentation.
          "${platform}" is currently not supported.`);
        }
    }
    get tag() {
        return `ubuntu-${this.version}-${this.builderPlatform}`.replace(/-+$/, '');
    }
    get image() {
        return `${this.repository}/${this.name}`.replace(/^\/+/, '');
    }
    toString() {
        const { image, tag, customImage } = this;
        if (customImage && customImage !== '') {
            return customImage;
        }
        const dockerRepoVersion = 1;
        return `${image}:${tag}-${dockerRepoVersion}`;
    }
}
exports.default = ImageTag;
