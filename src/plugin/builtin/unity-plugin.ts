import type { GameCIPlugin } from '../plugin-interface.ts';
import { UnityVersionDetector } from '../../middleware/engine-detection/unity-version-detector.ts';
import { UnityBuildCommand } from '../../command/build/unity-build-command.ts';
import { ActivateCommand } from '../../command/activate/activate-command.ts';
import { ReturnLicenseCommand } from '../../command/return-license/return-license-command.ts';
import { UnityOrchestrateCommand } from '../../command/orchestrate/unity-orchestrate-command.ts';
import { UnityLogsCommand } from '../../command/logs/unity-logs-command.ts';
import { UnityRunCommand } from '../../command/run/unity-run-command.ts';
import { UnityTestCommand } from '../../command/test/unity-test-command.ts';
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
          case 'activate':
            return new ActivateCommand(command);
          case 'return-license':
            return new ReturnLicenseCommand(command);
          case 'orchestrate':
            return new UnityOrchestrateCommand(command);
          case 'run':
            return new UnityRunCommand(command);
          case 'test':
            return new UnityTestCommand(command);
          case 'remote':
            switch (subCommands[0]) {
              case 'run':
              case 'build':
                return new UnityOrchestrateCommand(command);
              default:
                return new NonExistentCommand([command, ...subCommands].join(' '));
            }
          case 'logs':
            switch (subCommands[0]) {
              case 'collect':
              case 'tail':
              case 'pull':
              case 'fetch':
              case undefined:
              case '':
                return new UnityLogsCommand(command, subCommands[0] || 'collect');
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
