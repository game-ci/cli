"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = __importDefault(require("./platform"));
class ImageTag {
    customImage;
    repository;
    editorVersion;
    targetPlatform;
    targetPlatformSuffix;
    imagePlatformPrefix;
    imageRollingVersion;
    constructor(imageProperties) {
        const { editorVersion = '2022.3.7f1', targetPlatform = ImageTag.getImagePlatformType(process.platform), customImage, containerRegistryRepository, containerRegistryImageVersion, } = imageProperties;
        if (!ImageTag.versionPattern.test(editorVersion)) {
            throw new Error(`Invalid version "${editorVersion}".`);
        }
        // Either
        this.customImage = customImage;
        // Or
        this.repository = containerRegistryRepository;
        this.editorVersion = editorVersion;
        this.targetPlatform = targetPlatform;
        this.targetPlatformSuffix = ImageTag.getTargetPlatformSuffix(targetPlatform, editorVersion);
        this.imagePlatformPrefix = ImageTag.getImagePlatformPrefix(process.platform);
        this.imageRollingVersion = Number(containerRegistryImageVersion);
    }
    static get versionPattern() {
        return /^\d+\.\d+\.\d+[a-z]\d+$/;
    }
    static get targetPlatformSuffixes() {
        return {
            generic: '',
            webgl: 'webgl',
            mac: 'mac-mono',
            windows: 'windows-il2cpp',
            linux: 'base',
            linuxIl2cpp: 'linux-il2cpp',
            android: 'android',
            ios: 'ios',
            facebook: 'facebook',
        };
    }
    static getImagePlatformPrefix(platform) {
        switch (platform) {
            case 'linux':
                return 'ubuntu';
            case 'win32':
                return 'windows';
            default:
                throw new Error(`The Operating System of this runner, "${platform}", is not yet supported.`);
        }
    }
    static getImagePlatformType(platform) {
        switch (platform) {
            case 'linux':
                return platform_1.default.types.StandaloneLinux64;
            case 'win32':
                return platform_1.default.types.StandaloneWindows;
            default:
                throw new Error(`The Operating System of this runner, "${platform}", is not yet supported.`);
        }
    }
    static getTargetPlatformSuffix(targetPlatform, editorVersion) {
        const { generic, webgl, mac, windows, linux, linuxIl2cpp, android, ios, facebook } = ImageTag.targetPlatformSuffixes;
        const [major, minor] = editorVersion.split('.').map((digit) => Number(digit));
        // @see: https://docs.unity3d.com/ScriptReference/BuildTarget.html
        switch (targetPlatform) {
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
          "${targetPlatform}" is currently not supported.`);
        }
    }
    get tag() {
        const versionAndTarget = `${this.editorVersion}-${this.targetPlatformSuffix}`.replace(/-+$/, '');
        return `${this.imagePlatformPrefix}-${versionAndTarget}-${this.imageRollingVersion}`;
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
