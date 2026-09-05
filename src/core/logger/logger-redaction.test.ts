import { describe, it, expect, afterEach, mock } from 'bun:test';
import { configureLogger, Verbosity } from './index.ts';
import { SecretRedaction } from '../../model/secret-redaction.ts';

const originalLog = console.log;
const originalGlobalLog = (globalThis as any).log;

afterEach(() => {
  console.log = originalLog;
  SecretRedaction.reset();
  (globalThis as any).log = originalGlobalLog;
});

/**
 * The call sites that leak secrets log whole *objects*, not strings:
 * cli.ts's `parsed:` dump hands over the entire options bag, and loadConfig
 * logs the config file's cliOptions. Redaction therefore has to happen after
 * the logger has flattened its arguments, which is why it lives in the logger
 * rather than at each call site.
 */
describe('logger secret redaction', () => {
  const captureInfo = async (msg: any, ...args: any[]) => {
    const lines: string[] = [];
    console.log = mock((line: string) => {
      lines.push(line);
    }) as any;

    await configureLogger(Verbosity.veryVerbose);
    (globalThis as any).log.info(msg, ...args);

    return lines.join('\n');
  };

  it('redacts a secret nested inside a logged object', async () => {
    SecretRedaction.register('SUPERSECRET_PW');

    const output = await captureInfo('parsed:', { unityPassword: 'SUPERSECRET_PW', targetPlatform: 'WebGL' });

    expect(output).not.toContain('SUPERSECRET_PW');
    expect(output).toContain('***');
    // Non-secret fields must survive - redaction that eats the whole line
    // would make -vv useless.
    expect(output).toContain('WebGL');
  });

  it('redacts secrets registered from an options bag', async () => {
    SecretRedaction.registerFromOptions({
      unityPassword: 'pw-from-options',
      unitySerial: 'F4-SERIAL-VALUE',
      projectPath: '/work/project',
    });

    const output = await captureInfo('parsed:', {
      unityPassword: 'pw-from-options',
      unitySerial: 'F4-SERIAL-VALUE',
      projectPath: '/work/project',
    });

    expect(output).not.toContain('pw-from-options');
    expect(output).not.toContain('F4-SERIAL-VALUE');
    expect(output).toContain('/work/project');
  });

  it('leaves output untouched when nothing is registered', async () => {
    const output = await captureInfo('parsed:', { targetPlatform: 'WebGL' });

    expect(output).toContain('WebGL');
    expect(output).not.toContain('***');
  });
});
