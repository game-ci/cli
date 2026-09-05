import { describe, it, expect, mock, afterEach } from 'bun:test';
import { ReturnLicenseCommand } from './return-license-command.ts';
import { Docker } from '../../model/index.ts';
import { MacBuilder } from '../../model/mac-builder.ts';
import { PlatformSetup } from '../../logic/unity/platform-setup/index.ts';
import { PlatformValidation } from '../../logic/unity/platform-validation/platform-validation.ts';
import { yargs } from '../../dependencies.ts';

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

describe('ReturnLicenseCommand', () => {
  it('runs Docker with returnLicenseOnly set, and returns true, on non-mac hosts', async () => {
    PlatformValidation.checkCompatibility = mock(() => {});
    PlatformSetup.setup = mock(() => Promise.resolve());
    const dockerRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;

    const command = new ReturnLicenseCommand('return-license');
    const result = await command.execute(baseOptions);

    expect(result).toBe(true);
    expect(dockerRunMock).toHaveBeenCalled();
    const [, optionsPassedToDocker] = dockerRunMock.mock.calls[0];
    expect(optionsPassedToDocker.returnLicenseOnly).toBe(true);
  });

  it('clears activateOnly, which would otherwise skip the return entirely', async () => {
    // The two flags are mutually exclusive: runsteps.sh's ACTIVATE_ONLY branch
    // exits without returning the license.
    PlatformValidation.checkCompatibility = mock(() => {});
    PlatformSetup.setup = mock(() => Promise.resolve());
    const dockerRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;

    const command = new ReturnLicenseCommand('return-license');
    await command.execute({ ...baseOptions, activateOnly: true });

    const [, optionsPassedToDocker] = dockerRunMock.mock.calls[0];
    expect(optionsPassedToDocker.activateOnly).toBe(false);
    expect(optionsPassedToDocker.returnLicenseOnly).toBe(true);
  });

  it('runs MacBuilder instead of Docker on darwin hosts', async () => {
    PlatformValidation.checkCompatibility = mock(() => {});
    PlatformSetup.setup = mock(() => Promise.resolve());
    const dockerRunMock = mock(() => Promise.resolve());
    const macBuilderRunMock = mock(() => Promise.resolve());
    Docker.run = dockerRunMock;
    MacBuilder.run = macBuilderRunMock;

    const command = new ReturnLicenseCommand('return-license');
    await command.execute({ ...baseOptions, hostPlatform: 'darwin' });

    expect(macBuilderRunMock).toHaveBeenCalled();
    expect(dockerRunMock).not.toHaveBeenCalled();
  });

  it('does not mutate the original options object', async () => {
    PlatformValidation.checkCompatibility = mock(() => {});
    PlatformSetup.setup = mock(() => Promise.resolve());
    Docker.run = mock(() => Promise.resolve());

    const command = new ReturnLicenseCommand('return-license');
    await command.execute(baseOptions);

    expect(baseOptions.returnLicenseOnly).toBeUndefined();
  });

  it('defaults targetPlatform to NoTarget, not the build-oriented default', async () => {
    // Same reasoning as ActivateCommand's: returning a license doesn't build
    // anything, so it must not inherit build-target validation.
    const parser = yargs([])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });

    const command = new ReturnLicenseCommand('return-license');
    await command.configureOptions(parser as any);

    const argv = await parser.parseAsync();

    expect(argv.targetPlatform).toBe('NoTarget');
  });
});
