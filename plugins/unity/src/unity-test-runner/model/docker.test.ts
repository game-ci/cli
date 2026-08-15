import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Action from './action';

const execMock = vi.fn();
vi.mock('@actions/exec', () => ({
  exec: (...arguments_: unknown[]) => execMock(...arguments_),
}));

const fsState = { cidfileExists: false, cidfileContent: 'container-id' };
vi.mock('fs', () => ({
  existsSync: vi.fn(() => fsState.cidfileExists),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => fsState.cidfileContent),
  rmSync: vi.fn(() => {
    fsState.cidfileExists = false;
  }),
}));

const { existsSync, mkdirSync, readFileSync, rmSync } = await import('fs');
const Docker = (await import('./docker')).default;

function buildParameters(overrides: Record<string, unknown> = {}) {
  return {
    workspace: Action.rootFolder,
    actionFolder: Action.actionFolder,
    projectPath: `${Action.rootFolder}/test-project`,
    testMode: 'all',
    useHostNetwork: false,
    sshAgent: undefined,
    sshPublicKeysDirectoryPath: undefined,
    githubToken: undefined,
    runnerTemporaryPath: '/tmp',
    dockerCpuLimit: '2',
    dockerMemoryLimit: '4g',
    dockerIsolationMode: 'process',
    unityLicensingServer: '',
    githubAction: 'test-action',
    ...overrides,
  };
}

describe('Docker.run retry behavior', () => {
  beforeEach(() => {
    execMock.mockReset();
    fsState.cidfileExists = false;
    fsState.cidfileContent = 'container-id';
    vi.mocked(existsSync).mockClear();
    vi.mocked(mkdirSync).mockClear();
    vi.mocked(readFileSync).mockClear();
    vi.mocked(rmSync).mockClear();
    vi.stubGlobal(
      'setTimeout',
      ((fn: () => void) => {
        fn();
        return 0;
      }) as unknown as typeof setTimeout,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries a launch failure when a githubToken is set (USE_EXIT_CODE=false, exit code cannot mean a test failure)', async () => {
    execMock
      .mockRejectedValueOnce(new Error('docker.exe failed with exit code 1'))
      .mockRejectedValueOnce(new Error('docker.exe failed with exit code 1'))
      .mockResolvedValueOnce(0);

    await Docker.run('some-image', buildParameters({ githubToken: 'gh-token' }));

    expect(execMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after exhausting retries when a githubToken is set', async () => {
    execMock.mockRejectedValue(new Error('docker.exe failed with exit code 1'));

    await expect(
      Docker.run('some-image', buildParameters({ githubToken: 'gh-token' })),
    ).rejects.toThrow('docker.exe failed with exit code 1');

    expect(execMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry when no githubToken is set (a nonzero exit there means a real test failure)', async () => {
    execMock.mockRejectedValue(new Error('tests failed'));

    await expect(
      Docker.run('some-image', buildParameters({ githubToken: undefined })),
    ).rejects.toThrow('tests failed');

    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('cleans up a stale cidfile between retry attempts so --cidfile does not immediately fail again', async () => {
    fsState.cidfileExists = true;
    execMock
      .mockRejectedValueOnce(new Error('docker.exe failed with exit code 1'))
      .mockResolvedValueOnce(0);

    await Docker.run('some-image', buildParameters({ githubToken: 'gh-token' }));

    // ensureContainerRemoval should have run docker rm and dropped the cidfile
    expect(execMock).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['rm', '--force', '--volumes', 'container-id']),
      expect.anything(),
    );
    expect(rmSync).toHaveBeenCalled();
  });
});

describe('Docker.ensureContainerRemoval', () => {
  beforeEach(() => {
    execMock.mockReset();
    fsState.cidfileExists = false;
    fsState.cidfileContent = 'container-id';
    vi.mocked(rmSync).mockClear();
  });

  it('is a no-op when there is no cidfile', async () => {
    fsState.cidfileExists = false;
    await Docker.ensureContainerRemoval(buildParameters() as any);
    expect(execMock).not.toHaveBeenCalled();
  });

  it('still removes the cidfile even when docker rm fails', async () => {
    fsState.cidfileExists = true;
    execMock.mockRejectedValueOnce(new Error('no such container'));

    await expect(Docker.ensureContainerRemoval(buildParameters() as any)).rejects.toThrow(
      'no such container',
    );

    expect(rmSync).toHaveBeenCalled();
  });

  it('skips docker rm entirely when the cidfile is empty, but still removes it', async () => {
    fsState.cidfileExists = true;
    fsState.cidfileContent = '';

    await Docker.ensureContainerRemoval(buildParameters() as any);

    expect(execMock).not.toHaveBeenCalled();
    expect(rmSync).toHaveBeenCalled();
  });
});
