"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = __importDefault(require("./platform"));
class ImageTag {
    repository;
    editorVersion;
    targetPlatform;
    builderPlatform;
    customImage;
    imageRollingVersion;
    imagePlatformPrefix;
    constructor(imageProperties) {
        const { editorVersion, targetPlatform, customImage, buildPlatform, containerRegistryRepository, containerRegistryImageVersion, providerStrategy, } = imageProperties;
        if (!ImageTag.versionPattern.test(editorVersion)) {
            throw new Error(`Invalid version "${editorVersion}".`);
        }
        // Todo we might as well skip this class for customImage.
        // Either
        this.customImage = customImage;
        // Or
        this.repository = containerRegistryRepository;
        this.editorVersion = editorVersion;
        this.targetPlatform = targetPlatform;
        this.builderPlatform = ImageTag.getTargetPlatformToTargetPlatformSuffixMap(targetPlatform, editorVersion, providerStrategy);
        this.imagePlatformPrefix = ImageTag.getImagePlatformPrefixes(buildPlatform);
        this.imageRollingVersion = Number(containerRegistryImageVersion); // Will automatically roll to the latest non-breaking version.
    }
    static get versionPattern() {
        return /^\d+\.\d+\.\d+[a-z]\d+$/;
    }
    static get targetPlatformSuffixes() {
        return {
            generic: '',
            webgl: 'webgl',
            mac: 'mac-mono',
            windows: 'windows-mono',
            windowsIl2cpp: 'windows-il2cpp',
            wsaPlayer: 'universal-windows-platform',
            linux: 'base',
            linuxIl2cpp: 'linux-il2cpp',
            android: 'android',
            ios: 'ios',
            tvos: 'appletv',
            visionos: 'visionos',
            facebook: 'facebook',
        };
    }
    static getImagePlatformPrefixes(platform) {
        if (!platform || platform === '') {
            platform = process.platform;
        }
        switch (platform) {
            case 'win32':
                return 'windows';
            case 'linux':
                return 'ubuntu';
            default:
                return '';
        }
    }
    static getTargetPlatformToTargetPlatformSuffixMap(platform, version, providerStrategy) {
        const { generic, webgl, mac, windows, windowsIl2cpp, wsaPlayer, linux, linuxIl2cpp, android, ios, tvos, visionos, facebook, } = ImageTag.targetPlatformSuffixes;
        const [major, minor] = version.split('.').map((digit) => Number(digit));
        // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
        switch (platform) {
            case platform_1.default.types.StandaloneOSX:
                return mac;
            case platform_1.default.types.StandaloneWindows:
            case platform_1.default.types.StandaloneWindows64:
                // Can only build windows-il2cpp on a windows based system
                if (process.platform === 'win32') {
                    // Unity versions before 2019.3 do not support il2cpp
                    if (major >= 2020 || (major === 2019 && minor >= 3)) {
                        return windowsIl2cpp;
                    }
                    else {
                        throw new Error(`Windows-based builds are only supported on 2019.3.X+ versions of Unity.
                             If you are trying to build for windows-mono, please use a Linux based OS.`);
                    }
                }
                return windows;
            case platform_1.default.types.StandaloneLinux64: {
                // Unity versions before 2019.3 do not support il2cpp
                if (major >= 2020 || (major === 2019 && minor >= 3)) {
                    if (providerStrategy === 'local') {
                        return linuxIl2cpp;
                    }
                    else {
                        return process.env.USE_IL2CPP === 'true' ? linuxIl2cpp : linux;
                    }
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
                if (process.platform !== 'win32') {
                    throw new Error(`WSAPlayer can only be built on a windows base OS`);
                }
                return wsaPlayer;
            case platform_1.default.types.PS4:
                return windows;
            case platform_1.default.types.XboxOne:
                return windows;
            case platform_1.default.types.tvOS:
                if (process.platform !== 'win32' && process.platform !== 'darwin') {
                    throw new Error(`tvOS can only be built on Windows or macOS base OS`);
                }
                return tvos;
            case platform_1.default.types.VisionOS:
                if (process.platform !== 'darwin') {
                    throw new Error(`visionOS can only be built on a macOS base OS`);
                }
                return visionos;
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
        const versionAndPlatform = `${this.editorVersion}-${this.builderPlatform}`.replace(/-+$/, '');
        return `${this.imagePlatformPrefix}-${versionAndPlatform}-${this.imageRollingVersion}`;
    }
    get image() {
        return `${this.repository}`.replace(/^\/+/, '');
    }
    toString() {
        const { image, tag, customImage } = this;
        if (customImage)
            return customImage;
        return `${image}:${tag}`;
    }
}
exports.default = ImageTag;
