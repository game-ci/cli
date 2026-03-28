import { fsSync as fs, path } from '../dependencies.ts';
import { Action } from './action.ts';

describe('Action', () => {
  it('returns the canonical name', () => {
    expect(Action.canonicalName).toStrictEqual('unity-builder');
  });

  it('returns the root folder of the action', () => {
    const { rootFolder } = Action;
    expect(typeof rootFolder).toStrictEqual('string');
    expect(rootFolder.length).toBeGreaterThan(0);
  });

  it('returns the action folder', () => {
    const { actionFolder } = Action;
    expect(typeof actionFolder).toStrictEqual('string');
    expect(actionFolder.endsWith('dist')).toBe(true);
  });
});
