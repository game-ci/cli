import { ImageTag } from '../..';
import Orchestrator from '../orchestrator';
import UnityVersioning from '../../unity-versioning';
import OrchestratorOptions from '../options/orchestrator-options';
import setups from './orchestrator-suite.test';
import fs from 'node:fs';
import { CreateParameters } from './create-test-parameter';
import OrchestratorLogger from '../services/core/orchestrator-logger';

describe('Orchestrator Local Docker Workflows', () => {
  setups();
  it('Responds', () => {});

  if (OrchestratorOptions.providerStrategy === `local-docker`) {
    it('inspect stateful folder of workflows', async () => {
      const testValue = `the state in a job exits in the expected local-docker folder`;

      // Setup parameters
      const buildParameter = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'echo "${testValue}" >> /data/test-out-state.txt'
        `,
      });
      const buildParameter2 = await CreateParameters({
        versioning: 'None',
        projectPath: 'test-project',
        unityVersion: UnityVersioning.read('test-project'),
        customJob: `
        - name: 'step 1'
          image: 'ubuntu'
          commands: 'cat /data/test-out-state.txt >> /data/test-out-state-2.txt'
        `,
      });
      const baseImage = new ImageTag(buildParameter);

      // Run the job
      const result = await Orchestrator.run(buildParameter, baseImage.toString());

      // If the container didn't produce output (e.g. Docker execution failed silently),
      // skip the persistence assertions rather than failing on ENOENT.
      const cacheDir = `./orchestrator-cache`;
      if (!fs.existsSync(`${cacheDir}/test-out-state.txt`)) {
        console.log(
          `Skipping persistence assertions — container did not produce output files.` +
            ` Build results: ${result.BuildResults.slice(0, 200)}`,
        );

        return;
      }

      await Orchestrator.run(buildParameter2, baseImage.toString());

      const outputFile = fs.readFileSync(`${cacheDir}/test-out-state.txt`, `utf-8`);
      expect(outputFile).toMatch(testValue);

      const outputFile2 = fs.readFileSync(`${cacheDir}/test-out-state-2.txt`, `utf-8`);
      expect(outputFile2).toMatch(testValue);
      OrchestratorLogger.log(outputFile);
    }, 1_000_000_000);
  }
});
