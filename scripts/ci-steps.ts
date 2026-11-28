import { parse } from 'yaml';

/** A `run` step of a GitHub Actions job, as `bun run verify` replays it. */
export type CiStep = {
  readonly name: string;
  readonly shell: CiShell;
  readonly script: string;
  readonly env: Readonly<Record<string, string>>;
};

export type CiShell = 'bash' | 'pwsh';

export type CiStepsResult = { ok: true; steps: CiStep[] } | { ok: false; error: string };

type WorkflowStep = Record<string, unknown> & {
  name?: string;
  run?: string;
  uses?: string;
  shell?: string;
  env?: Record<string, unknown>;
};

const SHELLS: ReadonlySet<string> = new Set<CiShell>(['bash', 'pwsh']);

/** Keys verify reproduces faithfully; any other key could make a local run differ from CI. */
const SUPPORTED_KEYS: ReadonlySet<string> = new Set(['name', 'run', 'shell', 'env']);

const EXPRESSION = /\$\{\{/;

const toStep = (step: WorkflowStep): CiStep | string => {
  const script = step.run ?? '';
  const name = step.name ?? script.split('\n')[0] ?? '';
  const unsupportedKey = Object.keys(step).find((key) => !SUPPORTED_KEYS.has(key));
  const shell = step.shell ?? 'bash';

  if (unsupportedKey) return `Step '${name}' uses '${unsupportedKey}', which verify does not support.`;
  if (!SHELLS.has(shell)) return `Step '${name}' uses shell '${shell}', which verify does not support.`;
  if (EXPRESSION.test(script)) return `Step '${name}' has a \${{ }} expression in its script.`;

  // An expression (a secret, a context) has no local value: the variable is
  // left out, so the local environment's own value, if any, applies.
  const env = Object.fromEntries(
    Object.entries(step.env ?? {})
      .map(([key, value]) => [key, String(value)] as const)
      .filter(([, value]) => !EXPRESSION.test(value)),
  );

  return { name, shell: shell as CiShell, script, env };
};

export const CiSteps = {
  /** The `run` steps of one job, in order; `uses` steps (checkout, toolchain setup) are left to the developer. */
  fromWorkflow: (workflowText: string, jobId: string): CiStepsResult => {
    const workflow = parse(workflowText) as { jobs?: Record<string, { steps?: WorkflowStep[] }> };
    const job = workflow.jobs?.[jobId];
    if (!job) return { ok: false, error: `The workflow has no job '${jobId}'.` };

    const steps: CiStep[] = [];
    for (const step of job.steps ?? []) {
      if (step.uses !== undefined) continue;
      const parsed = toStep(step);
      if (typeof parsed === 'string') return { ok: false, error: parsed };
      steps.push(parsed);
    }

    return { ok: true, steps };
  },
} as const;
