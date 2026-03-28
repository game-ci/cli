import { PluginRegistry } from '../../plugin/plugin-registry.ts';

export class EngineDetector {
  private readonly projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  public detect(): { engine: string; engineVersion: string } {
    // Query the plugin registry for engine detection
    return PluginRegistry.detectEngine(this.projectPath);
  }
}
