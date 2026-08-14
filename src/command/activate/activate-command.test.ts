import { describe, it, expect, mock, afterEach } from 'bun:test';
import { ActivateCommand } from './activate-command.ts';
import { Docker } from '../../model/index.ts';
import { MacBuilder } from '../../model/mac-builder.ts';
import { PlatformSetup } from '../../logic/unity/platform-setup/index.ts';
import { PlatformValidation } from '../../logic/unity/platform-validation/platform-validation.ts';

const originalDockerRun = Docker.run;
const originalMacBuilderRun = MacBuilder.run;
const originalPlatformSetup = PlatformSetup.setup;
const originalCheckCompatibility = PlatformValidation.checkCompatibility;

afterEach(() => {
  // All are shared statics — restore them so other test files exercising the
  // real implementations aren't affected by this file's mocks.
  Docker.run = originalDockerRun;
  MacBuilder.run = originalMacBuilderRun;
  PlatformSetup.setup = originalPlatformSetup;
  PlatformValidation.checkCompatibility = originalCheckCompatibility;
});

const baseOptions = { hostPlatform: 'linux', engineVersion: '2019.2.11f1', targetPlatform: 'Test' } as any;

describe('ActivateCommand', () => {
  it('runs Docker with activateOnly set, and returns true, on non-mac hosts', async () => {
    PlatformValidation.checkCompatibility = mock(() => {});
    PlatformSetup.setup = mock(() => Promise.resolve());
    const dockerRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;

    const command = new ActivateCommand('activate');
    const result = await command.execute(baseOptions);

    expect(result).toBe(true);
    expect(dockerRunMock).toHaveBeenCalled();
    const [, optionsPassedToDocker] = dockerRunMock.mock.calls[0];
    expect(optionsPassedToDocker.activateOnly).toBe(true);
  });

  it('runs MacBuilder instead of Docker on darwin hosts', async () => {
    PlatformValidation.checkCompatibility = mock(() => {});
    PlatformSetup.setup = mock(() => Promise.resolve());
    const dockerRunMock = mock(() => Promise.resolve());
    const macBuilderRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;
    MacBuilder.run = macBuilderRunMock;

    const command = new ActivateCommand('activate');
    await command.execute({ ...baseOptions, hostPlatform: 'darwin' });

    expect(macBuilderRunMock).toHaveBeenCalled();
    expect(dockerRunMock).not.toHaveBeenCalled();
  });

  it('does not mutate the original options object', async () => {
    PlatformValidation.checkCompatibility = mock(() => {});
    PlatformSetup.setup = mock(() => Promise.resolve());
    Docker.run = mock(() => Promise.resolve());

    const command = new ActivateCommand('activate');
    await command.execute(baseOptions);

    expect(baseOptions.activateOnly).toBeUndefined();
  });
});
