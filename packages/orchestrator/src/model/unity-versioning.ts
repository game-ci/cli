/**
 * Bridge file — stub for UnityVersioning.
 *
 * The orchestrator tests import this to create test parameters with
 * realistic editor versions.  The real implementation reads
 * ProjectSettings/ProjectVersion.txt from the Unity project.
 */

import * as fs from 'fs';
import * as path from 'path';

class UnityVersioning {
  static async determineUnityVersion(projectPath: string, unityVersion: string): Promise<string> {
    if (unityVersion) return unityVersion;

    try {
      return UnityVersioning.read(projectPath);
    } catch {
      return '2021.3.0f1';
    }
  }

  static read(projectPath: string): string {
    const versionFile = path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
    const content = fs.readFileSync(versionFile, 'utf8');

    return UnityVersioning.parse(content);
  }

  static parse(projectVersionTxt: string): string {
    const match = projectVersionTxt.match(/m_EditorVersion:\s*(.*)/);
    if (!match) throw new Error('Failed to parse ProjectVersion.txt');

    return match[1].trim();
  }
}

export default UnityVersioning;
export { UnityVersioning };
