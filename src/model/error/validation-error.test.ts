import { ValidationError } from './validation-error.ts';

describe('ValidationError', () => {
  it('instantiates', () => {
    const error = new ValidationError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toStrictEqual('ValidationError');
  });

  test.each(['one'])('Displays title %s', (message) => {
    const error = new ValidationError(message);

    expect(error.name).toStrictEqual('ValidationError');
    expect(error.message).toStrictEqual(message.toString());
  });
});
