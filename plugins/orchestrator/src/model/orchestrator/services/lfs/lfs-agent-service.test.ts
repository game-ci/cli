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
import fs from 'node:fs';
import path from 'node:path';
import { LfsAgentService } from './lfs-agent-service';
import { OrchestratorSystem } from '../core/orchestrator-system';
import OrchestratorLogger from '../core/orchestrator-logger';

// Mock dependencies
vi.mock('node:fs');
vi.mock('../core/orchestrator-system', () => ({
  OrchestratorSystem: {
    Run: vi.fn().mockResolvedValue(''),
  },
}));
vi.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    logWarning: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFs = fs as Mocked<typeof fs>;

describe('LfsAgentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configure', () => {
    it('should call correct git config commands when agent exists', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(true);

      await LfsAgentService.configure(
        '/usr/local/bin/elastic-git-storage',
        '--verbose',
        ['/storage/path1', '/storage/path2'],
        '/repo',
      );

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.customtransfer.elastic-git-storage.path "/usr/local/bin/elastic-git-storage"`,
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.customtransfer.elastic-git-storage.args "--verbose"`,
      );
      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.standalonetransferagent elastic-git-storage`,
      );
    });

    it('should set LFS_STORAGE_PATHS environment variable when storagePaths provided', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(true);

      await LfsAgentService.configure(
        '/usr/local/bin/elastic-git-storage',
        '',
        ['/path/a', '/path/b'],
        '/repo',
      );

      expect(process.env.LFS_STORAGE_PATHS).toBe('/path/a;/path/b');
    });

    it('should log warning and return early when agent executable does not exist', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(false);

      await LfsAgentService.configure('/nonexistent/agent', '', [], '/repo');

      expect(OrchestratorSystem.Run).not.toHaveBeenCalled();
    });

    it('should derive agent name from executable filename', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(true);

      await LfsAgentService.configure('/tools/my-custom-agent.exe', '', [], '/repo');

      expect(OrchestratorSystem.Run).toHaveBeenCalledWith(
        `git -C "/repo" config lfs.customtransfer.my-custom-agent.path "/tools/my-custom-agent.exe"`,
      );
    });
  });

  describe('configure with empty storagePaths', () => {
    it('should not set LFS_STORAGE_PATHS when storagePaths is empty', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(true);

      const originalValue = process.env.LFS_STORAGE_PATHS;
      delete process.env.LFS_STORAGE_PATHS;

      await LfsAgentService.configure('/usr/local/bin/agent', '', [], '/repo');

      expect(process.env.LFS_STORAGE_PATHS).toBeUndefined();

      if (originalValue !== undefined) {
        process.env.LFS_STORAGE_PATHS = originalValue;
      }
    });
  });

  describe('validate', () => {
    it('should return true when agent executable exists', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(true);
      const result = await LfsAgentService.validate('/usr/local/bin/elastic-git-storage');
      expect(result).toBe(true);
    });

    it('should return false when agent executable does not exist', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(false);
      const result = await LfsAgentService.validate('/nonexistent/agent');
      expect(result).toBe(false);
    });

    it('should log warning when agent does not exist', async () => {
      (mockFs.existsSync as vi.Mock).mockReturnValue(false);

      await LfsAgentService.validate('/nonexistent/agent');

      expect(OrchestratorLogger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('Agent executable not found'),
      );
    });
  });
});
