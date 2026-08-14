declare const Platform: {
    readonly default: string;
    readonly types: {
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
        Switch: string;
        Lumin: string;
        BJM: string;
        Stadia: string;
        Facebook: string;
        NoTarget: string;
        Test: string;
    };
    isWindows(platform: any): boolean;
    isAndroid(platform: any): boolean;
};
export default Platform;
