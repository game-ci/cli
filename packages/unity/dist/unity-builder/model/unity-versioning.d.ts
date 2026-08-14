export default class UnityVersioning {
    static determineUnityVersion(projectPath: string, unityVersion: string): string;
    static read(projectPath: string): string;
    static parse(projectVersionTxt: string): string;
}
