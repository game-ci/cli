import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import {
  PreflightService,
  listBuiltInChecks,
  builtInChecks,
} from '../../model/orchestrator/services/preflight';

interface PreflightArguments {
  suite?: string;
  list?: boolean;
  check?: string;
}

const preflightCommand: CommandModule<object, PreflightArguments> = {
  command: 'preflight',
  describe: 'Run fast preflight validation checks before a build',
  builder: (yargs) => {
    return yargs
      .option('suite', {
        type: 'string',
        description:
          'Path to a preflight suite YAML. Defaults to .game-ci/preflight-suite.yml when omitted.',
      })
      .option('list', {
        type: 'boolean',
        description: 'List all built-in preflight checks and exit',
        default: false,
      })
      .option('check', {
        type: 'string',
        description: 'Run a single check by ID (built-in or defined in the suite)',
      })
      .example('game-ci preflight', 'Run the default preflight suite')
      .example('game-ci preflight --suite ./custom-suite.yml', 'Run a specific suite file')
      .example('game-ci preflight --list', 'List built-in preflight checks')
      .example('game-ci preflight --check runner-health', 'Run a single built-in check') as any;
  },
  handler: async (cliArguments) => {
    try {
      if (cliArguments.list) {
        printBuiltInList();
        return;
      }

      if (cliArguments.check) {
        await runSingleCheck(cliArguments.check, cliArguments.suite);
        return;
      }

      const suite = PreflightService.loadSuite(cliArguments.suite);
      core.info(`Running preflight suite: ${suite.name}`);

      const results = await PreflightService.executeSuite(suite);
      PreflightService.reportResults(results);

      if (!results.passed) {
        core.setFailed(`Preflight suite '${suite.name}' failed.`);
        process.exit(1);
      }
    } catch (error: any) {
      core.setFailed(`Preflight failed: ${error.message}`);
      throw error;
    }
  },
};

function printBuiltInList(): void {
  const checks = listBuiltInChecks();
  core.info(`Built-in preflight checks (${checks.length}):\n`);
  core.info('| ID | Category | Name |');
  core.info('|----|----------|------|');
  for (const check of checks) {
    core.info(`| ${check.id} | ${check.category} | ${check.name} |`);
  }
  core.info('\nReference any of these IDs as a string entry in a suite file.');
}

async function runSingleCheck(checkId: string, suitePath?: string): Promise<void> {
  // First, try the built-in registry. If not found, fall back to the suite
  // file (the user may be running a custom check defined inline there).
  let check = builtInChecks.get(checkId);

  if (!check && suitePath) {
    const suite = PreflightService.loadSuite(suitePath);
    const resolved = PreflightService.resolveChecks(suite);
    check = resolved.find((c) => c.id === checkId);
  }

  if (!check) {
    throw new Error(
      `Check '${checkId}' not found. Use 'game-ci preflight --list' to see built-in checks, ` +
        `or pass --suite <path> if the check is defined in a custom suite.`,
    );
  }

  const result = await PreflightService.executeCheck(check);
  PreflightService.reportResults({
    passed: result.passed,
    results: [result],
    duration: result.duration,
    failedAt: result.passed ? undefined : 0,
  });

  if (!result.passed) {
    core.setFailed(`Check '${checkId}' failed.`);
    process.exit(1);
  }
}

export default preflightCommand;
