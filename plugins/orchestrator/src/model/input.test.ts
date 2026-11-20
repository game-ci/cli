import Input from './input';
import { Cli } from './cli/cli';

describe('Input.getInput', () => {
  const saved = { ...process.env };

  afterEach(() => {
    Cli.options = undefined;
    process.env = { ...saved };
  });

  // Remote build containers run the remote-cli commands in CLI mode and receive
  // the build's parameters (CACHE_KEY, BUILD_GUID, ...) as environment variables.
  it('falls back to the environment in CLI mode', () => {
    Cli.options = { mode: 'cli' };
    process.env.CACHE_KEY = 'test-case-1';
    process.env.buildGuid = '117-linux64-luxn';

    expect(Input.getInput('cacheKey')).toBe('test-case-1');
    expect(Input.getInput('buildGuid')).toBe('117-linux64-luxn');
  });

  it('prefers CLI options over the environment', () => {
    Cli.options = { mode: 'cli', cacheKey: 'from-cli' };
    process.env.CACHE_KEY = 'from-env';

    expect(Input.getInput('cacheKey')).toBe('from-cli');
  });

  it('prefers an action input over the environment', () => {
    process.env.INPUT_CACHEKEY = 'from-input';
    process.env.CACHE_KEY = 'from-env';

    expect(Input.getInput('cacheKey')).toBe('from-input');
  });
});
