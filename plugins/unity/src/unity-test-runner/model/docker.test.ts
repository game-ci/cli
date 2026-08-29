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
      .mockResolvedValueOnce(0) // docker pull
      .mockRejectedValueOnce(new Error('docker.exe failed with exit code 1'))
      .mockRejectedValueOnce(new Error('docker.exe failed with exit code 1'))
      .mockResolvedValueOnce(0);

    await Docker.run('some-image', buildParameters({ githubToken: 'gh-token' }));

    // 1 pull + 3 run attempts
    expect(execMock).toHaveBeenCalledTimes(4);
  });

  it('gives up after exhausting retries when a githubToken is set', async () => {
    execMock
      .mockResolvedValueOnce(0) // docker pull
      .mockRejectedValue(new Error('docker.exe failed with exit code 1'));

    await expect(
      Docker.run('some-image', buildParameters({ githubToken: 'gh-token' })),
    ).rejects.toThrow('docker.exe failed with exit code 1');

    // 1 pull + 3 run attempts
    expect(execMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry when no githubToken is set (a nonzero exit there means a real test failure)', async () => {
    execMock
      .mockResolvedValueOnce(0) // docker pull
      .mockRejectedValue(new Error('tests failed'));

    await expect(
      Docker.run('some-image', buildParameters({ githubToken: undefined })),
    ).rejects.toThrow('tests failed');

    // 1 pull + 1 run attempt
    expect(execMock).toHaveBeenCalledTimes(2);
  });

  it('pulls the image explicitly before running, so pull time is not folded into the license-hold window', async () => {
    execMock.mockResolvedValue(0);

    await Docker.run('unityci/editor:some-tag', buildParameters({ githubToken: 'gh-token' }));

    expect(execMock).toHaveBeenNthCalledWith(1, 'docker', ['pull', 'unityci/editor:some-tag']);
  });

  it('does not attempt to run if the pull itself fails - a pull failure is not launch-retryable', async () => {
    execMock.mockRejectedValueOnce(new Error('manifest unknown'));

    await expect(
      Docker.run('some-image', buildParameters({ githubToken: 'gh-token' })),
    ).rejects.toThrow('manifest unknown');

    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('cleans up a stale cidfile between retry attempts so --cidfile does not immediately fail again', async () => {
    fsState.cidfileExists = true;
    execMock
      .mockResolvedValueOnce(0) // docker pull
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
