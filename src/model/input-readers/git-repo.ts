import { assert } from 'https://deno.land/std@0.142.0/testing/asserts.ts';
import { fsSync as fs } from '../../dependencies.ts';
import { CloudRunnerSystem } from '../cloud-runner/services/cloud-runner-system.ts';
import CloudRunnerLogger from '../cloud-runner/services/cloud-runner-logger.ts';
import Input from '../input.ts';

// Todo - DENO - return assertions
export class GitRepoReader {
  public static async GetRemote() {
    if (Input.cloudRunnerCluster === 'local') {
      return '';
    }
    assert(fs.existsSync(`.git`));
    const upstream = await CloudRunnerSystem.Run(`git remote -v`, false, true);
    const value = upstream.replace(/ /g, '');
    CloudRunnerLogger.log(`value ${value}`);
    assert(value.includes('github.com'));

    return value.split('github.com/')[1].split('.git')[0];
  }

  public static async GetBranch() {
    if (Input.cloudRunnerCluster === 'local') return '';

    assert(fs.existsSync(`.git`));
    const currentBranch = await CloudRunnerSystem.Run(`git branch --show-current`, false, true);

    return currentBranch.split('\n')[0].replace(/ /g, ``).replace('/head', '');
  }
}
