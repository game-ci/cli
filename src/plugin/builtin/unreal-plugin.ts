import type { GameCIPlugin } from '../plugin-interface.ts';
import { UnrealProjectDetector } from '../../middleware/engine-detection/unreal-project-detector.ts';
import { UnrealBuildCommand } from '../../command/build/unreal-build-command.ts';
import type { CommandInterface } from '../../command/command-interface.ts';

/**
 * Built-in Unreal Engine plugin.
 * Registers UE project detection and UE-specific commands.
 *
 * UE builds require a custom Docker image due to EULA restrictions.
 * Common options:
 *   - ghcr.io/epicgames/unreal-engine (official, requires access)
 *   - adamrehn/ue4-docker (community)
 */
export const unrealPlugin: GameCIPlugin = {
  name: 'unreal',
  version: '1.0.0',

  engineDetectors: [
    {
      name: 'unreal',
      detect(projectPath: string) {
        if (UnrealProjectDetector.isUnrealProject(projectPath)) {
          const engineVersion = UnrealProjectDetector.getUnrealVersion(projectPath);
          return { engine: 'unreal', engineVersion };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: 'unreal',
      createCommand(command: string, subCommands: string[]): CommandInterface | null {
        switch (command) {
          case 'build':
            return new UnrealBuildCommand(command);
          default:
            return null;
        }
      },
    },
  ],
};
