import { describe, it, expect } from 'bun:test';
import { UnityBatchmodeFailure } from './unity-batchmode-failure.ts';

describe('UnityBatchmodeFailure', () => {
  // Real, live example (see the class's own comment): Unity's actual stdout
  // shape when it refuses to run at all.
  const realWorldStdout = [
    'Using project path "/github/workspace/.".',
    '',
    '###########################',
    '#   Testing in editmode  #',
    '###########################',
    '',
    'Aborting batchmode due to failure:',
    'Scripts have compiler errors.',
    '',
    '[UnityConnectServicesConfig] Local config successfully read...',
  ].join('\n');

  describe('extractReason', () => {
    it('extracts the reason line following the abort marker', () => {
      expect(UnityBatchmodeFailure.extractReason(realWorldStdout)).toBe('Scripts have compiler errors.');
    });

    it('returns undefined when stdout has no abort marker', () => {
      expect(UnityBatchmodeFailure.extractReason('Build succeeded!\nDone.')).toBeUndefined();
    });

    it('returns undefined for undefined stdout', () => {
      expect(UnityBatchmodeFailure.extractReason(undefined)).toBeUndefined();
    });

    it('returns undefined for empty stdout', () => {
      expect(UnityBatchmodeFailure.extractReason('')).toBeUndefined();
    });
  });

  describe('describe', () => {
    it('returns a clear message including the extracted reason and the original error', () => {
      const described = UnityBatchmodeFailure.describe(realWorldStdout, 'Command exited with code 1');

      expect(described).toContain('Scripts have compiler errors.');
      expect(described).toContain('Command exited with code 1');
      expect(described).toContain('not a\ndocker/game-ci infrastructure problem');
    });

    it('returns undefined when there is nothing to extract, leaving the caller to fall back to the original error', () => {
      expect(UnityBatchmodeFailure.describe('some unrelated stdout', 'Command exited with code 1')).toBeUndefined();
      expect(UnityBatchmodeFailure.describe(undefined, 'Command exited with code 1')).toBeUndefined();
    });
  });
});
