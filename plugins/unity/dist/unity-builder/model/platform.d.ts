declare class Platform {
    static get default(): string;
    static get types(): {
        StandaloneOSX: string;
        StandaloneWindows: string;
        StandaloneWindows64: string;
        StandaloneLinux64: string;
        iOS: string;
        Android: string;
        WebGL: string;
        WSAPlayer: string;
        PS4: string;
        XboxOne: string;
        tvOS: string;
        VisionOS: string;
        Switch: string;
        Lumin: string;
        BJM: string;
        Stadia: string;
        Facebook: string;
        NoTarget: string;
        Test: string;
    };
    static isWindows(platform: string): boolean;
    static isAndroid(platform: string): boolean;
}
export default Platform;
