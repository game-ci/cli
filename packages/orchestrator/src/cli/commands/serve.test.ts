import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import serveCommand from './serve';

describe('serve command', () => {
  it('should be defined with correct command name', () => {
    expect(serveCommand.command).toBe('serve');
  });

  it('should have a description', () => {
    expect(serveCommand.describe).toBeTruthy();
  });

  it('should register expected yargs options', () => {
    const mockYargs: any = {
      option: vi.fn().mockReturnThis(),
      example: vi.fn().mockReturnThis(),
    };

    (serveCommand.builder as any)(mockYargs);

    const registeredOptions = mockYargs.option.mock.calls.map((call: any[]) => call[0]);
    expect(registeredOptions).toContain('provider-strategy');
    expect(registeredOptions).toContain('target-platform');
    expect(registeredOptions).toContain('engine');
    expect(registeredOptions).toContain('container-cpu');
    expect(registeredOptions).toContain('container-memory');
  });
});
