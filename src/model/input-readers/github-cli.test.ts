import { GithubCliReader } from './github-cli.ts';
import { core } from '../../dependencies.ts';

describe(`github cli`, () => {
  // Todo - We can not assume that everyone has the GitHub cli installed locally.
  it.skip(`returns`, async () => {
    const token = await GithubCliReader.GetGitHubAuthToken();

    // Todo - use expect(result).toStrictEqual(something)
    core.info(token);
  });
});
