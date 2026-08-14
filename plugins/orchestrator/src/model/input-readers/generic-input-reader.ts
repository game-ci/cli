/**
 * Bridge file — GenericInputReader.
 *
 * In unity-builder this delegates to OrchestratorSystem.Run for remote
 * providers.  Here we import from the orchestrator source directly.
 */

import { OrchestratorSystem } from '../orchestrator/services/core/orchestrator-system';
import OrchestratorOptions from '../orchestrator/options/orchestrator-options';

export class GenericInputReader {
  public static async Run(command: string) {
    if (OrchestratorOptions.providerStrategy === 'local') return '';

    return await OrchestratorSystem.Run(command, false, true);
  }
}

export default GenericInputReader;
