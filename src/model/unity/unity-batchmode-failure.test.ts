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

    // The Windows step scripts run Unity via PowerShell, which can leave
    // stdout CRLF-terminated - this is the platform HostRunner's --local
    // path most needs the extraction to work on.
    it('extracts the reason when stdout is CRLF-terminated', () => {
      const crlfStdout = realWorldStdout.replaceAll('\n', '\r\n');

      expect(UnityBatchmodeFailure.extractReason(crlfStdout)).toBe('Scripts have compiler errors.');
    });
  });

  describe('describe', () => {
    it('returns a clear message including the extracted reason and the original error', () => {
      const described = UnityBatchmodeFailure.describe(realWorldStdout, 'Command exited with code 1');

      expect(described).toContain('Scripts have compiler errors.');
      expect(described).toContain('Command exited with code 1');
      expect(described).toContain('not a\ndocker/game-ci infrastructure problem');
    });

    // Regression: Docker.run passes no originalMessage, because its error
    // text is `docker run`'s stderr - pull progress it has already streamed
    // live. Appending that under "Original error:" made
    // MirrorNetworking/Mirror#4128 read as an editor failing to load a
    // version when Unity had in fact aborted on script compiler errors.
    it('omits the original-error section when the caller supplies nothing to add', () => {
      const described = UnityBatchmodeFailure.describe(realWorldStdout);

      expect(described).toContain('Scripts have compiler errors.');
      expect(described).not.toContain('Original error:');
    });

    it('returns undefined when there is nothing to extract, leaving the caller to fall back to the original error', () => {
      expect(UnityBatchmodeFailure.describe('some unrelated stdout', 'Command exited with code 1')).toBeUndefined();
      expect(UnityBatchmodeFailure.describe(undefined, 'Command exited with code 1')).toBeUndefined();
    });
  });
});
