import { describe, it, expect } from 'bun:test';
import { CliProtocolPlugin } from './cli-protocol-plugin.ts';

describe('CliProtocolPlugin', () => {
  it('should throw if no executable path provided', () => {
    expect(() => new CliProtocolPlugin({})).toThrow('--provider-executable');
  });

  it('should throw if executable path is empty string', () => {
    expect(() => new CliProtocolPlugin({ providerExecutable: '' })).toThrow('--provider-executable');
  });

  it('should construct successfully with a valid executable path', () => {
    const plugin = new CliProtocolPlugin({ providerExecutable: '/usr/local/bin/game-ci' });
    expect(plugin).toBeDefined();
  });

  it('should accept cliExecutable as alternative option name', () => {
    const plugin = new CliProtocolPlugin({ cliExecutable: '/usr/local/bin/game-ci' });
    expect(plugin).toBeDefined();
  });

  it('should implement all provider interface methods needed by the CLI', () => {
    const plugin = new CliProtocolPlugin({ providerExecutable: '/usr/local/bin/game-ci' });
    expect(typeof plugin.setupWorkflow).toBe('function');
    expect(typeof plugin.cleanupWorkflow).toBe('function');
    expect(typeof plugin.runTaskInWorkflow).toBe('function');
    expect(typeof plugin.garbageCollect).toBe('function');
    expect(typeof plugin.listResources).toBe('function');
    expect(typeof plugin.listWorkflow).toBe('function');
    expect(typeof plugin.watchWorkflow).toBe('function');
  });
});
