import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { EOL, tmpdir } from 'node:os';
import { join } from 'node:path';
import { core } from './index.ts';

const originalGitHubOutput = process.env['GITHUB_OUTPUT'];
const originalConsoleLog = console.log;

let directory: string | undefined;

/** An empty $GITHUB_OUTPUT file, as a runner would hand one to a step. */
function useOutputFile(): string {
  directory = mkdtempSync(join(tmpdir(), 'game-ci-outputs-'));
  const filePath = join(directory, 'outputs');
  writeFileSync(filePath, '');
  process.env['GITHUB_OUTPUT'] = filePath;
  return filePath;
}

afterEach(() => {
  if (originalGitHubOutput === undefined) {
    delete process.env['GITHUB_OUTPUT'];
  } else {
    process.env['GITHUB_OUTPUT'] = originalGitHubOutput;
  }

  console.log = originalConsoleLog;

  if (directory) {
    rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

describe('core.setOutput', () => {
  // The regression unity-builder v6 shipped with: the CLI printed a version
  // and never wrote the file, so buildVersion/androidVersionCode arrived
  // empty on every `unity-builder` run that used the CLI.
  it('writes a real record to $GITHUB_OUTPUT when a runner provides one', () => {
    const filePath = useOutputFile();

    core.setOutput('buildVersion', '1.166.0');

    const written = readFileSync(filePath, 'utf8');
    expect(written).toMatch(
      /^buildVersion<<ghadelimiter_[\w-]+\r?\n1\.166\.0\r?\nghadelimiter_[\w-]+\r?\n$/,
    );
  });

  // `key=value` would truncate at the first newline, so the delimiter form is
  // load-bearing rather than cosmetic.
  it('round-trips a value containing newlines', () => {
    const filePath = useOutputFile();

    core.setOutput('buildVersion', `1.166.0${EOL}second-line`);

    expect(readFileSync(filePath, 'utf8')).toContain(`1.166.0${EOL}second-line`);
  });

  it('appends instead of overwriting, so several outputs survive', () => {
    const filePath = useOutputFile();

    core.setOutput('buildVersion', '1.166.0');
    core.setOutput('androidVersionCode', '1166000');

    const written = readFileSync(filePath, 'utf8');
    expect(written).toContain('buildVersion<<');
    expect(written).toContain('androidVersionCode<<');
    expect(written).toContain('1166000');
  });

  it('falls back to printing when there is no $GITHUB_OUTPUT', () => {
    delete process.env['GITHUB_OUTPUT'];
    const printed: string[] = [];
    console.log = (message?: unknown) => {
      printed.push(String(message));
    };

    core.setOutput('buildVersion', '1.166.0');

    expect(printed).toEqual(['(mock) Output "buildVersion" is set to "1.166.0"']);
  });
});
