import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import ResultsCheck from './results-check';

describe('ResultsCheck', () => {
  describe('createCheck', () => {
    it('throws for missing input', async () => {
      // Original test was `expect(...).rejects;` with no matcher — a no-op
      // assertion. Replaced with a real `await expect(...).rejects.toThrow(...)`.
      await expect(ResultsCheck.createCheck('', '', '')).rejects.toThrow(/Missing input/);
    });
  });

  // GitHub rejects a check output body over 65534 characters. The overflow
  // branch used to drop the entire body, so the bigger the suite the less its
  // check reported - a 1532-test run rendered to 146600 characters and showed
  // nothing at all. Reported by a user reading their run's annotations.
  describe('truncateDetails', () => {
    const MAX = 65_534;
    const body = Array.from({ length: 5000 }, (_, index) => `| Test ${index} | passed |`).join('\n');

    it('keeps the details rather than dropping them', () => {
      const result = ResultsCheck.truncateDetails(body, MAX);

      expect(result).toContain('| Test 0 | passed |');
      expect(result).not.toContain('omitted from GitHub UI');
    });

    it('fits inside the limit', () => {
      expect(ResultsCheck.truncateDetails(body, MAX).length).toBeLessThanOrEqual(MAX);
    });

    it('says that it truncated', () => {
      expect(ResultsCheck.truncateDetails(body, MAX)).toContain('truncated');
    });

    it('cuts on a line boundary so the markdown does not end mid-row', () => {
      const kept = ResultsCheck.truncateDetails(body, MAX).split('\n\n_Test details')[0];

      expect(kept.endsWith(' |')).toBe(true);
    });

    it('leaves text that already fits completely alone', () => {
      expect(ResultsCheck.truncateDetails('short', MAX)).toBe('short');
    });

    it('falls back when the budget cannot even fit the notice', () => {
      expect(ResultsCheck.truncateDetails(body, 10)).toContain('omitted from GitHub UI');
    });
  });
});
