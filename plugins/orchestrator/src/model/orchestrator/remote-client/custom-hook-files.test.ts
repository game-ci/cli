import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RemoteClient } from '.';
import { RemoteClientLogger } from './remote-client-logger';
import { OrchestratorFolders } from '../options/orchestrator-folders';
import { OrchestratorSystem } from '../services/core/orchestrator-system';

describe('RemoteClient.runCustomHookFiles', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-hooks-'));
    vi.spyOn(OrchestratorFolders, 'repoPathAbsolute', 'get').mockReturnValue(repo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  // Hook files are optional: most projects have no game-ci/hooks folder.
  it('says so, without an error, when the project has no hook files', async () => {
    const log = vi.spyOn(RemoteClientLogger, 'log').mockImplementation(() => {});

    await RemoteClient.runCustomHookFiles('before-build');

    const messages = log.mock.calls.map(([message]) => message).join('\n');
    expect(messages).toContain('No custom hook files');
    expect(messages).not.toContain('ENOENT');
  });

  it('runs the hook files for the lifecycle', async () => {
    vi.spyOn(RemoteClientLogger, 'log').mockImplementation(() => {});
    const run = vi.spyOn(OrchestratorSystem, 'Run').mockResolvedValue('');
    fs.mkdirSync(path.join(repo, 'game-ci', 'hooks'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'game-ci', 'hooks', 'a.yaml'),
      'hook: before-build\ncommands: echo before\n',
    );
    fs.writeFileSync(
      path.join(repo, 'game-ci', 'hooks', 'b.yaml'),
      'hook: after-build\ncommands: echo after\n',
    );

    await RemoteClient.runCustomHookFiles('before-build');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('echo before');
  });
});
