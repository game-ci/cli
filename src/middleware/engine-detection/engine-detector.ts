import UnityVersionDetector from './unity-version-detector.ts';

export class EngineDetector {
  private readonly projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  public detect(): { engine: string; engineVersion: string } {
    if (UnityVersionDetector.isUnityProject(this.projectPath)) {
      const engineVersion = UnityVersionDetector.getUnityVersion(this.projectPath);

      return { engine: 'unity', engineVersion };
    }

    return {
      engine: 'unknown',
      engineVersion: 'unknown',
    };
  }
}
