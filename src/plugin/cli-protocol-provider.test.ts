import { describe, it, expect } from 'bun:test';
import { CliProtocolProvider } from './cli-protocol-provider.ts';

describe('CliProtocolProvider', () => {
  it('should throw if no executable path provided', () => {
    expect(() => new CliProtocolProvider({})).toThrow('--provider-executable');
  });

  it('should throw if executable path is empty string', () => {
    expect(() => new CliProtocolProvider({ providerExecutable: '' })).toThrow('--provider-executable');
  });

  it('should construct successfully with a valid executable path', () => {
    const provider = new CliProtocolProvider({ providerExecutable: '/usr/local/bin/game-ci' });
    expect(provider).toBeDefined();
  });

  it('should accept cliExecutable as alternative option name', () => {
    const provider = new CliProtocolProvider({ cliExecutable: '/usr/local/bin/game-ci' });
    expect(provider).toBeDefined();
  });

  it('should implement all ProviderPlugin methods', () => {
    const provider = new CliProtocolProvider({ providerExecutable: '/usr/local/bin/game-ci' });
    expect(typeof provider.setupWorkflow).toBe('function');
    expect(typeof provider.cleanupWorkflow).toBe('function');
    expect(typeof provider.runTaskInWorkflow).toBe('function');
    expect(typeof provider.garbageCollect).toBe('function');
    expect(typeof provider.listResources).toBe('function');
    expect(typeof provider.listWorkflow).toBe('function');
    expect(typeof provider.watchWorkflow).toBe('function');
  });
});
