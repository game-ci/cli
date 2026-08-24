import { describe, it, expect } from 'vitest';
import { createAntiCheatMiddleware } from './anti-cheat-middleware';

const command = 'eac-tool sign ./Builds/StandaloneWindows64/Game.exe';

describe('createAntiCheatMiddleware', () => {
  it('runs after the build, when a player actually exists', () => {
    const middleware = createAntiCheatMiddleware({ provider: 'easy-anti-cheat', command });

    expect(middleware.trigger.phase).toEqual(['post-build']);
    expect(middleware.after?.commands).toBe(command);
    // A pre-build/build hook would have nothing to operate on.
    expect(middleware.before).toBeUndefined();
  });

  it('never allows failure', () => {
    const middleware = createAntiCheatMiddleware({ provider: 'battleye', command });

    // A build that skipped its integrity step but still produced a
    // shippable player is the worst outcome: it looks successful and ships
    // unprotected.
    expect(middleware.allowFailure).toBe(false);
  });

  it('sorts ahead of default-priority packaging steps', () => {
    const middleware = createAntiCheatMiddleware({ provider: 'easy-anti-cheat', command });

    // Default middleware priority is 100; an unprotected binary must not be
    // packaged or uploaded before this runs.
    expect(middleware.priority).toBeLessThan(100);
  });

  it('requires a command, since the vendor SDKs are NDA-gated', () => {
    expect(() =>
      createAntiCheatMiddleware({ provider: 'easy-anti-cheat', command: '   ' }),
    ).toThrow(/NDA-gated/i);
  });

  it('passes credentials as secrets rather than interpolating them into the command', () => {
    const middleware = createAntiCheatMiddleware({
      provider: 'easy-anti-cheat',
      command,
      secretNames: ['EAC_API_KEY'],
    });

    expect(middleware.secrets).toHaveLength(1);
    expect(middleware.secrets[0].ParameterKey).toBe('EAC_API_KEY');
    expect(middleware.secrets[0].EnvironmentVariable).toBe('EAC_API_KEY');
    // The value must never be baked into the definition.
    expect(middleware.secrets[0].ParameterValue).toBe('');
    expect(middleware.after?.commands).not.toContain('EAC_API_KEY');
  });

  it('is a command middleware by default and a container one when an image is given', () => {
    expect(createAntiCheatMiddleware({ provider: 'battleye', command }).type).toBe('command');

    const containerized = createAntiCheatMiddleware({
      provider: 'battleye',
      command,
      image: 'vendor/battleye:1',
    });
    expect(containerized.type).toBe('container');
    expect(containerized.image).toBe('vendor/battleye:1');
  });

  it('restricts to the given platforms, and to all platforms when unset', () => {
    expect(
      createAntiCheatMiddleware({
        provider: 'battleye',
        command,
        platforms: ['StandaloneWindows64'],
      }).trigger.platform,
    ).toEqual(['StandaloneWindows64']);

    expect(
      createAntiCheatMiddleware({ provider: 'battleye', command }).trigger.platform,
    ).toBeUndefined();
  });

  it('names the middleware per provider so two can coexist', () => {
    expect(createAntiCheatMiddleware({ provider: 'easy-anti-cheat', command }).name).toBe(
      'anti-cheat-easy-anti-cheat',
    );
    expect(createAntiCheatMiddleware({ provider: 'battleye', command }).name).toBe(
      'anti-cheat-battleye',
    );
  });
});
