import { yargs } from '../dependencies.ts';
import { BuildOptions } from './build-options.ts';

describe('BuildOptions', () => {
  it('derives buildFile from the resolved default buildName', async () => {
    const parser = yargs(['--targetPlatform', 'StandaloneLinux64'])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });

    BuildOptions.configure(parser);

    const argv = await parser.parseAsync();

    expect(argv.buildName).toBe('StandaloneLinux64');
    expect(argv.buildPath).toBe('build/StandaloneLinux64');
    expect(argv.buildFile).toBe('StandaloneLinux64');
  });

  it('uses android export type when deriving Android buildFile', async () => {
    const parser = yargs([
      '--targetPlatform',
      'Android',
      '--buildName',
      'GameCI',
      '--androidExportType',
      'androidAppBundle',
    ])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });

    BuildOptions.configure(parser);

    const argv = await parser.parseAsync();

    expect(argv.buildFile).toBe('GameCI.aab');
  });

  it('defaults manualExit to false and accepts --manualExit', async () => {
    const defaultParser = yargs(['--targetPlatform', 'StandaloneLinux64'])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });
    BuildOptions.configure(defaultParser);
    const defaultArgv = await defaultParser.parseAsync();
    expect(defaultArgv.manualExit).toBe(false);

    const enabledParser = yargs(['--targetPlatform', 'StandaloneLinux64', '--manualExit'])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });
    BuildOptions.configure(enabledParser);
    const enabledArgv = await enabledParser.parseAsync();
    expect(enabledArgv.manualExit).toBe(true);
  });

  it('defaults the new game-ci/cli#65 audit options and accepts them when set', async () => {
    const defaultParser = yargs(['--targetPlatform', 'StandaloneLinux64'])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });
    BuildOptions.configure(defaultParser);
    const defaultArgv = await defaultParser.parseAsync();
    expect(defaultArgv.buildProfile).toBe('');
    expect(defaultArgv.skipActivation).toBe(false);
    expect(defaultArgv.runAsHostUser).toBe(false);
    expect(defaultArgv.enableGpu).toBe(false);
    expect(defaultArgv.gitConfigExtensions).toBe('');

    const setParser = yargs([
      '--targetPlatform',
      'StandaloneLinux64',
      '--buildProfile',
      'Assets/Settings/Linux.asset',
      '--skipActivation',
      '--runAsHostUser',
      '--enableGpu',
      '--gitConfigExtensions',
      'http.sslVerify=false',
    ])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });
    BuildOptions.configure(setParser);
    const setArgv = await setParser.parseAsync();
    expect(setArgv.buildProfile).toBe('Assets/Settings/Linux.asset');
    expect(setArgv.skipActivation).toBe(true);
    expect(setArgv.runAsHostUser).toBe(true);
    expect(setArgv.enableGpu).toBe(true);
    expect(setArgv.gitConfigExtensions).toBe('http.sslVerify=false');
  });
});
