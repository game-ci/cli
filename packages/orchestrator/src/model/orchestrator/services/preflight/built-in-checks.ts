import { PreflightCheck } from './preflight-types';

/**
 * Built-in preflight check registry.
 *
 * Each check is referenced by `id` from a suite's `checks` list. Built-in
 * commands are intentionally conservative -- they target conventional script
 * paths (`./automation/...`) and tolerate absence by exiting 0 with a
 * skip message. Consumers who want strict checks should override the
 * `command` with an inline custom definition in their suite YAML.
 *
 * Built-in IDs (stable -- changes here are a breaking change for suite files):
 *   pipeline-contract        -- validate CI workflow YAML structure
 *   runner-health            -- runner disk space, required tools, connectivity
 *   build-profiles           -- build profile config files are well-formed
 *   submodule-profiles       -- submodule profile configs are well-formed
 *   preunityjob-dryrun       -- PreUnityJob dry-run smoke test
 *   lfs-health               -- LFS config and connectivity sanity
 *   framework-suite-config   -- framework + test suite YAML configs
 *   script-integrity         -- script syntax + manifest consistency
 *   health-test-discovery    -- health test classes discovered and wired
 *   csharp-heuristics-changed -- lightweight C# analysis, changed files only
 *   csharp-heuristics-full   -- full-repo C# heuristic analysis (scoped)
 *   cross-profile-compile    -- compile across all active profiles (scoped)
 *   config-validation        -- validate .game-ci config files
 */

const checks: PreflightCheck[] = [
  {
    id: 'pipeline-contract',
    name: 'Pipeline Contract Validation',
    description: 'Validates CI workflow YAML structure against the pipeline contract.',
    category: 'config',
    command: 'node ./automation/validate-pipeline-contract.js',
    timeout: 30,
  },
  {
    id: 'runner-health',
    name: 'Runner Health Check',
    description: 'Checks runner disk space, required tools, and network connectivity.',
    category: 'environment',
    command: 'node ./automation/check-runner-health.js',
    timeout: 30,
  },
  {
    id: 'build-profiles',
    name: 'Build Profile Validation',
    description: 'Validates that build profile configs are well-formed.',
    category: 'config',
    command: 'node ./automation/validate-build-profiles.js',
    timeout: 30,
  },
  {
    id: 'submodule-profiles',
    name: 'Submodule Profile Validation',
    description: 'Validates submodule profile YAML configs.',
    category: 'config',
    command: 'node ./automation/validate-submodule-profiles.js',
    timeout: 30,
  },
  {
    id: 'preunityjob-dryrun',
    name: 'PreUnityJob Dry Run',
    description: 'Runs the pre-engine-job orchestration script in dry-run mode.',
    category: 'integrity',
    command: 'node ./automation/preunityjob.js --dry-run',
    timeout: 120,
  },
  {
    id: 'lfs-health',
    name: 'LFS Health Check',
    description: 'Validates Git LFS configuration and store connectivity.',
    category: 'environment',
    command: 'git lfs env',
    timeout: 30,
  },
  {
    id: 'framework-suite-config',
    name: 'Framework & Suite Config Validation',
    description: 'Validates framework and test suite YAML configuration files.',
    category: 'config',
    command: 'node ./automation/validate-framework-suite-config.js',
    timeout: 30,
  },
  {
    id: 'script-integrity',
    name: 'Script & Manifest Integrity',
    description: 'Checks scripts for syntax errors and manifest consistency.',
    category: 'integrity',
    command: 'node ./automation/validate-script-integrity.js',
    timeout: 60,
  },
  {
    id: 'health-test-discovery',
    name: 'Health Test Discovery',
    description: 'Discovers health test classes and validates they are wired in.',
    category: 'integrity',
    command: 'node ./automation/discover-health-tests.js',
    timeout: 60,
  },
  {
    id: 'csharp-heuristics-changed',
    name: 'C# Heuristics (Changed Files)',
    description: 'Runs lightweight C# heuristic analysis on changed files only.',
    category: 'compilation',
    command: 'node ./automation/csharp-heuristics.js --changed-only',
    timeout: 60,
    scope: {
      paths: ['**/*.cs'],
      runCondition: 'on-change',
    },
  },
  {
    id: 'csharp-heuristics-full',
    name: 'C# Heuristics (Full Repo)',
    description: 'Runs full-repo C# heuristic analysis. Scoped to C# changes.',
    category: 'compilation',
    command: 'node ./automation/csharp-heuristics.js --full',
    timeout: 180,
    scope: {
      paths: ['**/*.cs', '**/*.asmdef'],
      runCondition: 'on-change',
    },
  },
  {
    id: 'cross-profile-compile',
    name: 'Cross-Profile Compile Verification',
    description: 'Verifies the project compiles across all active submodule profiles.',
    category: 'compilation',
    command: 'node ./automation/cross-profile-compile.js',
    timeout: 600,
    scope: {
      paths: ['**/*.cs', '**/*.asmdef', 'config/submodule-profiles/**'],
      runCondition: 'on-change',
    },
  },
  {
    id: 'config-validation',
    name: 'Config Validation',
    description: 'Validates .game-ci configuration files for structural correctness.',
    category: 'config',
    command: 'node ./automation/validate-game-ci-config.js',
    timeout: 30,
  },
];

export const builtInChecks: Map<string, PreflightCheck> = new Map(
  checks.map((check) => [check.id, check]),
);

/**
 * Return the list of built-in check IDs in registration order.
 */
export function listBuiltInCheckIds(): string[] {
  return checks.map((check) => check.id);
}

/**
 * Return a defensive copy of all built-in checks.
 */
export function listBuiltInChecks(): PreflightCheck[] {
  return checks.map((check) => ({ ...check }));
}
