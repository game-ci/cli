import * as Index from './index.ts';

describe('Index', () => {
  test.each([
    'Action',
    'CacheValidation',
    'Docker',
    'RunnerImageTag',
    'Output',
    'UnityTargetPlatform',
    'UnityProject',
    'BuildVersionGenerator',
  ])('exports %s', (exportedModule) => {
    expect(Index[exportedModule]).toBeDefined();
  });
});
