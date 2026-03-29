import { NotImplementedException } from './not-implemented-exception.ts';

describe('NotImplementedException', () => {
  it('instantiates', () => {
    const error = new NotImplementedException();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toStrictEqual('NotImplementedException');
  });

  test.each(['one'])('Displays title %s', (message) => {
    const error = new NotImplementedException(message);

    expect(error.name).toStrictEqual('NotImplementedException');
    expect(error.message).toStrictEqual(message.toString());
  });
});
