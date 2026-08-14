import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
  type MockedFunction,
} from 'vitest';
import { execFileSync } from 'node:child_process';
import { UnityProcessService } from './unity-process-service';

vi.mock('node:child_process');
vi.mock('../core/orchestrator-logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    logWarning: vi.fn(),
  },
}));

const mockExecFileSync = execFileSync as MockedFunction<typeof execFileSync>;

describe('UnityProcessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses cleanup output from the PowerShell helper', () => {
    const result = UnityProcessService.parseCleanupOutput(
      'KILLED=12,34\r\nHUB=True\r\nLICENSING=False\r\n',
    );

    expect(result).toEqual({
      skipped: false,
      killedProcessIds: [12, 34],
      hubRunning: true,
      licensingClientRunning: false,
    });
  });

  it('returns killed process ids when cleanup runs on Windows', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mockExecFileSync.mockReturnValue('KILLED=42\nHUB=True\nLICENSING=True\n' as any);

    const result = UnityProcessService.cleanupWorkspaceProcesses('C:/workspace/project');

    expect(result.killedProcessIds).toEqual([42]);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'powershell.exe',
      expect.any(Array),
      expect.any(Object),
    );

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
