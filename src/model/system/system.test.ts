import { core } from '../../dependencies.ts';
import System from './system.ts';

jest.spyOn(core, 'debug').mockImplementation(() => {});
const info = jest.spyOn(core, 'info').mockImplementation(() => {});
jest.spyOn(core, 'warning').mockImplementation(() => {});
jest.spyOn(core, 'error').mockImplementation(() => {});
const execSpy = jest.spyOn(System, 'run').mockImplementation(async () => 0);

afterEach(() => jest.clearAllMocks());

describe('System', () => {
  describe('run', () => {
    describe('units', () => {
      it('passes the command to command line', async () => {
        await expect(System.run('echo test')).resolves.not.toBeNull();
        await expect(execSpy).toHaveBeenLastCalledWith('echo test', expect.anything(), expect.anything());
      });

      it('throws on when error code is not 0', async () => {
        execSpy.mockImplementationOnce(async () => 1);
        await expect(System.run('false')).rejects.toThrowError();
      });

      it('throws when no command is given', async () => {
        await expect(System.run('')).rejects.toThrowError();
      });

      it('throws when command consists only of spaces', async () => {
        await expect(System.run(' \t\n')).rejects.toThrowError();
      });

      it('outputs info', async () => {
        execSpy.mockImplementationOnce(async (input, _, options) => {
          options?.listeners?.stdout?.(Buffer.from(input, 'utf8'));

          return 0;
        });

        await expect(System.run('foo-bar')).resolves.not.toBeNull();
        expect(info).toHaveBeenCalledTimes(1);
        expect(info).toHaveBeenLastCalledWith('foo-bar');
      });
    });
  });
});
