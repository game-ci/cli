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
});
