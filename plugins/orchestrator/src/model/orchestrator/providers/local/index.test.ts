import LocalOrchestrator from './index';

describe('LocalOrchestrator.garbageCollect', () => {
  it('resolves successfully instead of throwing "Method not implemented."', async () => {
    const provider = new LocalOrchestrator();

    await expect(provider.garbageCollect('', true, 24, true, true)).resolves.not.toThrow();
  });

  it('returns a string result (does not reject)', async () => {
    const provider = new LocalOrchestrator();

    const result = await provider.garbageCollect('', false, 24, false, false);

    expect(typeof result).toBe('string');
  });
});
