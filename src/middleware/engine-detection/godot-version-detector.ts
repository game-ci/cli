import { fsSync as fs, path } from '../../dependencies.ts';
import * as nodeFs from 'node:fs';

export class GodotVersionDetector {
  static get versionPattern() {
    return /\d+\.\d+(?:\.\d+)?/;
  }

  public static isGodotProject(projectPath: string): boolean {
    const filePath = path.join(projectPath, 'project.godot');
    return fs.existsSync(filePath);
  }

  static getGodotVersion(projectPath: string): string {
    return GodotVersionDetector.read(projectPath);
  }

  static read(projectPath: string): string {
    const filePath = path.join(projectPath, 'project.godot');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Godot project file not found at "${filePath}". Have you correctly set the projectPath?`);
    }

    return GodotVersionDetector.parse(nodeFs.readFileSync(filePath, 'utf-8'));
  }

  static parse(projectGodot: string): string {
    // Look for config/features=PackedStringArray("4.3") or similar
    const featuresMatch = projectGodot.match(/config\/features\s*=\s*PackedStringArray\("(\d+\.\d+)"/);
    if (featuresMatch) {
      return featuresMatch[1];
    }

    // Fallback: look for any version-like string after compatibility markers
    const compatMatch = projectGodot.match(/config\/features\s*=.*?(\d+\.\d+(?:\.\d+)?)/);
    if (compatMatch) {
      return compatMatch[1];
    }

    throw new Error('Failed to parse Godot version from project.godot');
  }
}
