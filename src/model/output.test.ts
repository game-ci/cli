import { Output } from './output.ts';

describe('Output', () => {
  describe('setBuildVersion', () => {
    it('does not throw', () => {
      expect(() => Output.setBuildVersion('1.0.0')).not.toThrow();
    });
  });
});
