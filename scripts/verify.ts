/**
 * Runs the Tests job of .github/workflows/tests.yml locally, step by step, so
 * a push meets no check that wasn't run first. The workflow stays the single
 * source of the steps; this only replays them, the way the runner does:
 * bash with -eo pipefail, pwsh stopping on the first error, from the repo
 * root, stopping at the first failing step.
 *
 * Usage: bun run verify
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type CiShell, type CiStep, CiSteps } from './ci-steps';

const WORKFLOW = '.github/workflows/tests.yml';
const JOB = 'tests';

const repoRoot = path.resolve(import.meta.dirname, '..');

const invocation: Record<
  CiShell,
  { extension: string; wrap: (script: string) => string; argv: (file: string) => string[] }
> = {
  bash: {
    extension: '.sh',
    wrap: (script) => script,
    argv: (file) => ['bash', '--noprofile', '--norc', '-eo', 'pipefail', file],
  },
  pwsh: {
    extension: '.ps1',
    wrap: (script) =>
      `$ErrorActionPreference = 'stop'\n${script}\nif ((Test-Path -LiteralPath variable:\\LASTEXITCODE)) { exit $LASTEXITCODE }\n`,
    argv: (file) => ['pwsh', '-NoProfile', '-NonInteractive', '-File', file],
  },
};

const fail = (message: string): never => {
  console.error(`\nverify: ${message}`);
  process.exit(1);
};

/** Runs one step; returns why it failed, or null when it passed. */
const runStep = (step: CiStep, index: number, total: number, scriptDir: string): string | null => {
  const { extension, wrap, argv } = invocation[step.shell];
  const file = path.join(scriptDir, `step-${index}${extension}`);
  fs.writeFileSync(file, wrap(step.script));

  console.log(`\n▶ [${index}/${total}] ${step.name}`);
  const started = performance.now();
  const [command, ...args] = argv(file);
  const result = spawnSync(command, args, { cwd: repoRoot, env: { ...process.env, ...step.env }, stdio: 'inherit' });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);

  if (result.error) return `'${step.name}' could not start: ${result.error.message}`;
  if (result.status !== 0) {
    return `'${step.name}' failed (exit ${result.status ?? result.signal}) after ${seconds}s. CI runs the same step.`;
  }
  console.log(`✔ ${step.name} (${seconds}s)`);
  return null;
};

const parsed = CiSteps.fromWorkflow(fs.readFileSync(path.join(repoRoot, WORKFLOW), 'utf8'), JOB);
if (!parsed.ok) fail(`cannot replay ${WORKFLOW}: ${parsed.error}`);
const { steps } = parsed as Extract<typeof parsed, { ok: true }>;

const missingShells = [...new Set(steps.map((step) => step.shell))].filter((shell) => !Bun.which(shell));
if (missingShells.length > 0) {
  fail(
    `${missingShells.join(', ')} not found on PATH; the Tests job needs it (pwsh: https://aka.ms/install-powershell).`,
  );
}

console.log(`Replaying ${steps.length} steps of the ${JOB} job in ${WORKFLOW}.`);
const scriptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-ci-verify-'));
let failure: string | null = null;
try {
  for (const [index, step] of steps.entries()) {
    failure = runStep(step, index + 1, steps.length, scriptDir);
    if (failure) break;
  }
} finally {
  fs.rmSync(scriptDir, { recursive: true, force: true });
}
if (failure) fail(failure);
console.log(`\nAll ${steps.length} steps of the ${JOB} job passed.`);
