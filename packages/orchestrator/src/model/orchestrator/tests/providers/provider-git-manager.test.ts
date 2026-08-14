import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
  type Mocked,
} from 'vitest';
import { GitHubUrlInfo } from '../../providers/provider-url-parser';

// Import the mocked ProviderGitManager
import { ProviderGitManager } from '../../providers/provider-git-manager';

// Mock @actions/core to fix fs.promises compatibility issue
vi.mock('@actions/core', () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

// Mock fs module
vi.mock('fs');

// Mock the entire provider-git-manager module. `vi.mock` factory must be
// async to use `vi.importActual`.
vi.mock('../../providers/provider-git-manager', async () => {
  const originalModule = await vi.importActual<
    typeof import('../../providers/provider-git-manager')
  >('../../providers/provider-git-manager');

  return {
    ...originalModule,
    ProviderGitManager: {
      ...originalModule.ProviderGitManager,
      cloneRepository: vi.fn(),
      updateRepository: vi.fn(),
      getProviderModulePath: vi.fn(),
    },
  };
});
const mockProviderGitManager = ProviderGitManager as Mocked<typeof ProviderGitManager>;

describe('ProviderGitManager', () => {
  const mockUrlInfo: GitHubUrlInfo = {
    type: 'github',
    owner: 'test-user',
    repo: 'test-repo',
    branch: 'main',
    url: 'https://github.com/test-user/test-repo',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cloneRepository', () => {
    it('successfully clones a repository', async () => {
      const expectedResult = {
        success: true,
        localPath: '/path/to/cloned/repo',
      };
      mockProviderGitManager.cloneRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.cloneRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.localPath).toBe('/path/to/cloned/repo');
    });

    it('handles clone errors', async () => {
      const expectedResult = {
        success: false,
        localPath: '/path/to/cloned/repo',
        error: 'Clone failed',
      };
      mockProviderGitManager.cloneRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.cloneRepository(mockUrlInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clone failed');
    });
  });

  describe('updateRepository', () => {
    it('successfully updates a repository when updates are available', async () => {
      const expectedResult = {
        success: true,
        updated: true,
      };
      mockProviderGitManager.updateRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('reports no updates when repository is up to date', async () => {
      const expectedResult = {
        success: true,
        updated: false,
      };
      mockProviderGitManager.updateRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('handles update errors', async () => {
      const expectedResult = {
        success: false,
        updated: false,
        error: 'Update failed',
      };
      mockProviderGitManager.updateRepository.mockResolvedValue(expectedResult);

      const result = await mockProviderGitManager.updateRepository(mockUrlInfo);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('getProviderModulePath', () => {
    it('returns the specified path when provided', () => {
      const urlInfoWithPath = { ...mockUrlInfo, path: 'src/providers' };
      const localPath = '/path/to/repo';
      const expectedPath = '/path/to/repo/src/providers';

      mockProviderGitManager.getProviderModulePath.mockReturnValue(expectedPath);

      const result = mockProviderGitManager.getProviderModulePath(urlInfoWithPath, localPath);

      expect(result).toBe(expectedPath);
    });

    it('finds common entry points when no path specified', () => {
      const localPath = '/path/to/repo';
      const expectedPath = '/path/to/repo/index.js';

      mockProviderGitManager.getProviderModulePath.mockReturnValue(expectedPath);

      const result = mockProviderGitManager.getProviderModulePath(mockUrlInfo, localPath);

      expect(result).toBe(expectedPath);
    });

    it('returns repository root when no entry point found', () => {
      const localPath = '/path/to/repo';

      mockProviderGitManager.getProviderModulePath.mockReturnValue(localPath);

      const result = mockProviderGitManager.getProviderModulePath(mockUrlInfo, localPath);

      expect(result).toBe(localPath);
    });
  });
});
