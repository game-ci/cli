export default class AndroidVersioning {
    static determineVersionCode(version: string, inputVersionCode: string): string;
    static versionToVersionCode(version: string): string;
    static determineSdkManagerParameters(targetSdkVersion: string): string;
}
