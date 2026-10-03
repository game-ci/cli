import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Output } from './output.ts';

const originalGitHubOutput = process.env['GITHUB_OUTPUT'];

let directory: string | undefined;

afterEach(() => {
  if (originalGitHubOutput === undefined) {
    delete process.env['GITHUB_OUTPUT'];
  } else {
    process.env['GITHUB_OUTPUT'] = originalGitHubOutput;
  }

  if (directory) {
    rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

describe('Output', () => {
  describe('setBuildVersion', () => {
    it('does not throw', () => {
      expect(() => Output.setBuildVersion('1.0.0')).not.toThrow();
    });

    // The end of the chain unity-builder reads: `game-ci build` publishes a
    // version, and a wrapping action gets it out of $GITHUB_OUTPUT.
    it('reaches $GITHUB_OUTPUT', () => {
      directory = mkdtempSync(join(tmpdir(), 'game-ci-outputs-'));
      const filePath = join(directory, 'outputs');
      writeFileSync(filePath, '');
      process.env['GITHUB_OUTPUT'] = filePath;

      Output.setBuildVersion('1.166.0');
      Output.setAndroidVersionCode('1166000');

      const written = readFileSync(filePath, 'utf8');
      expect(written).toContain('buildVersion<<');
      expect(written).toContain('1.166.0');
      expect(written).toContain('androidVersionCode<<');
      expect(written).toContain('1166000');
    });
  });
});
