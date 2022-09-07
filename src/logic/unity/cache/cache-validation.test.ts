import CacheValidation from './cache-validation.ts';

describe('Cache', () => {
  describe('Verification', () => {
    it('does not throw', () => {
      expect(() => CacheValidation.verify()).not.toThrow();
    });
  });
});
