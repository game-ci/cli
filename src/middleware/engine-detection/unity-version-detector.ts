import { fsSync as fs, path } from '../../dependencies.ts';

export default class UnityVersionDetector {
  static get versionPattern() {
    return /20\d{2}\.\d\.\w{3,4}|3/;
  }

  public static isUnityProject(projectPath: string) {
    try {
      UnityVersionDetector.read(projectPath);

      return true;
    } catch {
      return false;
    }
  }

  static getUnityVersion(projectPath: string) {
    return UnityVersionDetector.read(projectPath);
  }

  static read(projectPath: string) {
    const filePath = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
    }

    return UnityVersionDetector.parse(Deno.readTextFileSync(filePath));
  }

  static parse(projectVersionTxt: string) {
    const matches = projectVersionTxt.match(UnityVersionDetector.versionPattern);
    if (!matches || matches.length === 0) {
      throw new Error(`Failed to parse version from "${projectVersionTxt}".`);
    }

    return matches[0];
  }
}
