import { describe, expect, it } from 'bun:test';
import { CiSteps } from './ci-steps';

const workflow = (steps: string) => `
name: Tests
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
${steps}
`;

describe('CiSteps.fromWorkflow', () => {
  it('reads run steps in order, skipping actions', () => {
    const result = CiSteps.fromWorkflow(
      workflow(`
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: bun install
      - name: Unit tests
        run: bun run test
`),
      'tests',
    );

    expect(result).toEqual({
      ok: true,
      steps: [
        { name: 'Install dependencies', shell: 'bash', script: 'bun install', env: {} },
        { name: 'Unit tests', shell: 'bash', script: 'bun run test', env: {} },
      ],
    });
  });

  it('keeps the shell of a pwsh step', () => {
    const result = CiSteps.fromWorkflow(
      workflow(`
      - name: Windows tests
        shell: pwsh
        run: ./scripts/test.ps1
`),
      'tests',
    );

    expect(result.ok && result.steps[0]?.shell).toBe('pwsh');
  });

  it('names an unnamed step after its first line', () => {
    const result = CiSteps.fromWorkflow(
      workflow(`
      - run: |
          echo one
          echo two
`),
      'tests',
    );

    expect(result.ok && result.steps[0]?.name).toBe('echo one');
  });

  it('keeps literal env values and leaves expressions to the local environment', () => {
    const result = CiSteps.fromWorkflow(
      workflow(`
      - name: Smoke test
        env:
          GH_TOKEN: \${{ secrets.TOKEN || github.token }}
          MODE: smoke
        run: bash smoke.sh
`),
      'tests',
    );

    expect(result.ok && result.steps[0]?.env).toEqual({ MODE: 'smoke' });
  });

  it('fails on a job the workflow does not have', () => {
    const result = CiSteps.fromWorkflow(workflow('      - run: true'), 'missing');

    expect(result).toEqual({ ok: false, error: "The workflow has no job 'missing'." });
  });

  it('fails on an expression inside a script, which only the runner can expand', () => {
    const result = CiSteps.fromWorkflow(
      workflow(`
      - name: Uses context
        run: echo \${{ github.sha }}
`),
      'tests',
    );

    expect(result).toEqual({ ok: false, error: "Step 'Uses context' has a \${{ }} expression in its script." });
  });

  it('fails on a step key it cannot reproduce locally', () => {
    const result = CiSteps.fromWorkflow(
      workflow(`
      - name: Conditional
        if: github.event_name == 'push'
        run: echo push
`),
      'tests',
    );

    expect(result).toEqual({ ok: false, error: "Step 'Conditional' uses 'if', which verify does not support." });
  });

  it('fails on a shell other than bash or pwsh', () => {
    const result = CiSteps.fromWorkflow(
      workflow(`
      - name: Python
        shell: python
        run: print(1)
`),
      'tests',
    );

    expect(result).toEqual({ ok: false, error: "Step 'Python' uses shell 'python', which verify does not support." });
  });
});
