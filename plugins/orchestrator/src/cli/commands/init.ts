import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import fs from 'node:fs';
import path from 'node:path';
import { templateGenerators } from './init-templates';

interface InitArgs {
  provider: string;
  platform: string;
  'workflow-type': string;
  'ci-provider': string;
  'output-dir': string;
  engine: string;
}

const initCommand: CommandModule<{}, InitArgs> = {
  command: 'init',
  describe: 'Generate CI/CD workflow files for your game project',
  builder: {
    provider: {
      description: 'Cloud provider strategy',
      type: 'string' as const,
      default: 'local',
      choices: ['local', 'local-docker', 'aws', 'k8s', 'gcp-cloud-run', 'azure-aci'],
    },
    platform: {
      description: 'Target build platform',
      type: 'string' as const,
      default: 'StandaloneLinux64',
    },
    'workflow-type': {
      description: 'Type of workflow to generate',
      type: 'string' as const,
      default: 'ci',
      choices: ['ci', 'cd', 'async'],
    },
    'ci-provider': {
      description: 'CI provider to generate workflow for',
      type: 'string' as const,
      default: 'github',
      choices: ['github', 'gitlab'],
    },
    'output-dir': {
      description: 'Output directory (project root)',
      type: 'string' as const,
      default: '.',
    },
    engine: {
      description: 'Game engine',
      type: 'string' as const,
      default: 'unity',
    },
  },
  handler: async (argv) => {
    const ciProvider = argv['ci-provider'];
    const workflowType = argv['workflow-type'];
    const outputDir = argv['output-dir'];

    const config = {
      provider: argv.provider,
      platform: argv.platform,
      workflowType,
      engine: argv.engine,
    };

    const generators = templateGenerators[ciProvider];
    if (!generators) {
      core.error(`Unsupported CI provider: ${ciProvider}`);
      process.exit(1);
    }

    const generator = generators[workflowType];
    if (!generator) {
      core.error(`Unsupported workflow type: ${workflowType} for ${ciProvider}`);
      process.exit(1);
    }

    const content = generator(config);

    let outputPath: string;
    if (ciProvider === 'github') {
      const workflowDir = path.join(outputDir, '.github', 'workflows');
      fs.mkdirSync(workflowDir, { recursive: true });
      outputPath = path.join(workflowDir, `game-ci-${workflowType}.yml`);
    } else {
      outputPath = path.join(outputDir, '.gitlab-ci.yml');
    }

    fs.writeFileSync(outputPath, content, 'utf8');
    core.info(`Generated ${ciProvider} ${workflowType} workflow: ${outputPath}`);
  },
};

export default initCommand;
