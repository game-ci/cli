import type { GameCIPlugin } from '../plugin-interface.ts';
import { GodotVersionDetector } from '../../middleware/engine-detection/godot-version-detector.ts';
import { GodotBuildCommand } from '../../command/build/godot-build-command.ts';
import { NonExistentCommand } from '../../command/null/non-existent-command.ts';
import type { CommandInterface } from '../../command/command-interface.ts';

/**
 * Built-in Godot plugin.
 * Registers Godot engine detection and Godot-specific commands.
 *
 * Uses barichello/godot-ci Docker images for builds.
 */
export const godotPlugin: GameCIPlugin = {
  name: 'godot',
  version: '1.0.0',

  engineDetectors: [
    {
      name: 'godot',
      detect(projectPath: string) {
        if (GodotVersionDetector.isGodotProject(projectPath)) {
          const engineVersion = GodotVersionDetector.getGodotVersion(projectPath);
          return { engine: 'godot', engineVersion };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: 'godot',
      createCommand(command: string, subCommands: string[]): CommandInterface | null {
        switch (command) {
          case 'build':
            return new GodotBuildCommand(command);
          default:
            return null;
        }
      },
    },
  ],
};
