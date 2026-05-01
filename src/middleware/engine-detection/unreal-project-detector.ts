import { fsSync as fs, path } from '../../dependencies.ts';
import * as nodeFs from 'node:fs';

export class UnrealProjectDetector {
  public static isUnrealProject(projectPath: string): boolean {
    const uprojectFiles = UnrealProjectDetector.findUprojectFile(projectPath);
    return uprojectFiles !== null;
  }

  static getUnrealVersion(projectPath: string): string {
    return UnrealProjectDetector.read(projectPath);
  }

  static findUprojectFile(projectPath: string): string | null {
    try {
      const files = nodeFs.readdirSync(projectPath);
      const uproject = files.find((f: string) => f.endsWith('.uproject'));
      return uproject ? path.join(projectPath, uproject) : null;
    } catch {
      return null;
    }
  }

  static read(projectPath: string): string {
    const filePath = UnrealProjectDetector.findUprojectFile(projectPath);
    if (!filePath) {
      throw new Error(`No .uproject file found in "${projectPath}". Have you correctly set the projectPath?`);
    }

    return UnrealProjectDetector.parse(nodeFs.readFileSync(filePath, 'utf-8'));
  }

  static parse(uprojectContent: string): string {
    const json = JSON.parse(uprojectContent);
    if (json.EngineAssociation) {
      return json.EngineAssociation;
    }

    throw new Error('Failed to parse Unreal Engine version from .uproject file');
  }
}
