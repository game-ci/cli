import { fsSync as fs, path, yaml, __dirname } from '../../dependencies.ts';
import Input from '../input.ts';

export function ReadLicense(parameters) {
  if (parameters.cloudRunnerCluster === 'local') {
    return '';
  }

  const pipelineFile = path.join(__dirname, `.github`, `workflows`, `cloud-runner-k8s-pipeline.yml`);

  return fs.existsSync(pipelineFile) ? yaml.parse(Deno.readTextFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE : '';
}
