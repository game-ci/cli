import { CommandExecutionError } from './command-execution-error.ts';

describe('CommandExecutionError', () => {
  it('instantiates', () => {
    const error = new CommandExecutionError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toStrictEqual('CommandExecutionError');
  });

  test.each(['one'])('Displays title %s', (message) => {
    const error = new CommandExecutionError(message);

    expect(error.name).toStrictEqual('CommandExecutionError');
    expect(error.message).toStrictEqual(message.toString());
  });
});
