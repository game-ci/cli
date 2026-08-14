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
    // Unity appends .x86_64 by default for StandaloneLinux64 - matches
    // unity-builder's default (linux64RemoveExecutableExtension: false).
    expect(argv.buildFile).toBe('StandaloneLinux64.x86_64');
  });

  it('omits the .x86_64 extension when linux64RemoveExecutableExtension is set', async () => {
    const parser = yargs(['--targetPlatform', 'StandaloneLinux64', '--linux64RemoveExecutableExtension'])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });

    BuildOptions.configure(parser);

    const argv = await parser.parseAsync();

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

  it('defaults the container registry, docker resource, and ssh options and accepts them when set', async () => {
    const defaultParser = yargs(['--targetPlatform', 'StandaloneLinux64'])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });
    BuildOptions.configure(defaultParser);
    const defaultArgv = await defaultParser.parseAsync();
    expect(defaultArgv.containerRegistryRepository).toBe('unityci/editor');
    expect(defaultArgv.containerRegistryImageVersion).toBe('3');
    expect(defaultArgv.dockerIsolationMode).toBe('default');
    expect(defaultArgv.useHostNetwork).toBe(false);
    expect(defaultArgv.sshPublicKeysDirectoryPath).toBe('');
    expect(typeof defaultArgv.dockerCpuLimit).toBe('string');
    expect(typeof defaultArgv.dockerMemoryLimit).toBe('string');

    const setParser = yargs([
      '--targetPlatform',
      'StandaloneLinux64',
      '--containerRegistryRepository',
      'ghcr.io/example/editor',
      '--containerRegistryImageVersion',
      '5',
      '--dockerIsolationMode',
      'process',
      '--useHostNetwork',
      '--sshPublicKeysDirectoryPath',
      '/home/runner/.ssh/keys',
      '--dockerCpuLimit',
      '2',
      '--dockerMemoryLimit',
      '4096m',
    ])
      .exitProcess(false)
      .fail((message, error) => {
        throw error || new Error(message);
      });
    BuildOptions.configure(setParser);
    const setArgv = await setParser.parseAsync();
    expect(setArgv.containerRegistryRepository).toBe('ghcr.io/example/editor');
    expect(setArgv.containerRegistryImageVersion).toBe('5');
    expect(setArgv.dockerIsolationMode).toBe('process');
    expect(setArgv.useHostNetwork).toBe(true);
    expect(setArgv.sshPublicKeysDirectoryPath).toBe('/home/runner/.ssh/keys');
    expect(setArgv.dockerCpuLimit).toBe('2');
    expect(setArgv.dockerMemoryLimit).toBe('4096m');
  });
});
