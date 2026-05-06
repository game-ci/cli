import type { GameCIPlugin } from '../plugin-interface.ts';
import { UnityVersionDetector } from '../../middleware/engine-detection/unity-version-detector.ts';
import { UnityBuildCommand } from '../../command/build/unity-build-command.ts';
import { UnityOrchestrateCommand } from '../../command/orchestrate/unity-orchestrate-command.ts';
import { NonExistentCommand } from '../../command/null/non-existent-command.ts';
import type { CommandInterface } from '../../command/command-interface.ts';

/**
 * Built-in Unity plugin.
 * Registers Unity engine detection and Unity-specific commands.
 */
export const unityPlugin: GameCIPlugin = {
  name: 'unity',
  version: '1.0.0',

  engineDetectors: [
    {
      name: 'unity',
      detect(projectPath: string) {
        if (UnityVersionDetector.isUnityProject(projectPath)) {
          const engineVersion = UnityVersionDetector.getUnityVersion(projectPath);
          return { engine: 'unity', engineVersion };
        }
        return null;
      },
    },
  ],

  commands: [
    {
      engine: 'unity',
      createCommand(command: string, subCommands: string[]): CommandInterface | null {
        switch (command) {
          case 'build':
            return new UnityBuildCommand(command);
          case 'orchestrate':
            return new UnityOrchestrateCommand(command);
          case 'remote':
            switch (subCommands[0]) {
              case 'run':
              case 'build':
                return new UnityOrchestrateCommand(command);
              default:
                return new NonExistentCommand([command, ...subCommands].join(' '));
            }
          default:
            return null;
        }
      },
    },
  ],
};
