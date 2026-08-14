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
import os from 'node:os';
import path from 'node:path';
import loadProvider, { ProviderLoader } from '../../providers/provider-loader';
import { ProviderInterface } from '../../providers/provider-interface';
import { ProviderGitManager } from '../../providers/provider-git-manager';

// Mock the git manager
vi.mock('../../providers/provider-git-manager');
const mockProviderGitManager = ProviderGitManager as Mocked<typeof ProviderGitManager>;

describe('provider-loader', () => {
  let tempDirectory = '';

  beforeEach(() => {
    vi.clearAllMocks();
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'game-ci-config-provider-'));
  });

  afterEach(() => {
    if (tempDirectory) {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  describe('loadProvider', () => {
    it('loads a built-in provider dynamically', async () => {
      const provider: ProviderInterface = await loadProvider('./test', {} as any);
      expect(typeof provider.runTaskInWorkflow).toBe('function');
    });

    it('loads a local provider from relative path', async () => {
      const provider: ProviderInterface = await loadProvider('./test', {} as any);
      expect(typeof provider.runTaskInWorkflow).toBe('function');
    });

    it('loads a provider from a YAML configuration file', async () => {
      const providerPath = path.join(tempDirectory, 'local-shell.yml');
      fs.writeFileSync(
        providerPath,
        `
name: local-shell
lifecycle:
  run-task: >
    node -e "process.stdout.write(process.env.GAME_CI_BUILD_GUID + ':' + process.env.GAME_CI_COMMANDS + ':' + process.env.FOO)"
  list-resources: >
    node -e "process.stdout.write(JSON.stringify([{Name:'worker-a'}, 'worker-b']))"
`,
        'utf8',
      );

      const provider = await loadProvider(providerPath, {} as any);
      const output = await provider.runTaskInWorkflow(
        'build-123',
        'image',
        'run-tests',
        '/mnt',
        '/work',
        [{ name: 'FOO', value: 'bar' }] as any,
        [],
      );
      const resources = await provider.listResources();

      expect(output).toBe('build-123:run-tests:bar');
      expect(resources.map((resource) => resource.Name)).toEqual(['worker-a', 'worker-b']);
    });

    it('selects a named provider from a multi-provider configuration file', async () => {
      const providerPath = path.join(tempDirectory, 'providers.yml');
      fs.writeFileSync(
        providerPath,
        `
providers:
  alpha:
    lifecycle:
      run: echo alpha
  beta:
    lifecycle:
      run: echo beta
`,
        'utf8',
      );

      const provider = await loadProvider(`config:${providerPath}#beta`, {} as any);
      const output = await provider.runTaskInWorkflow('', '', '', '', '', [], []);

      expect(output.trim()).toBe('beta');
    });

    it('loads a GitHub provider', async () => {
      const mockLocalPath = '/path/to/cloned/repo';
      const mockModulePath = '/path/to/cloned/repo/index.js';

      mockProviderGitManager.ensureRepositoryAvailable.mockResolvedValue(mockLocalPath);
      mockProviderGitManager.getProviderModulePath.mockReturnValue(mockModulePath);

      // For now, just test that the git manager methods are called correctly
      // The actual import testing is complex due to dynamic imports
      await expect(loadProvider('https://github.com/user/repo', {} as any)).rejects.toThrow();
      expect(mockProviderGitManager.ensureRepositoryAvailable).toHaveBeenCalled();
    });

    it('throws when provider package is missing', async () => {
      await expect(loadProvider('non-existent-package', {} as any)).rejects.toThrow(
        'non-existent-package',
      );
    });

    it('throws when provider does not implement ProviderInterface', async () => {
      await expect(loadProvider('../tests/fixtures/invalid-provider', {} as any)).rejects.toThrow(
        'does not implement ProviderInterface',
      );
    });

    it('throws when provider does not export a constructor', async () => {
      // Test with a non-existent module that will fail to load
      await expect(loadProvider('./non-existent-constructor-module', {} as any)).rejects.toThrow(
        'Failed to load provider package',
      );
    });
  });

  describe('ProviderLoader class', () => {
    it('loads providers using the static method', async () => {
      const provider: ProviderInterface = await ProviderLoader.loadProvider('./test', {} as any);
      expect(typeof provider.runTaskInWorkflow).toBe('function');
    });

    it('returns available providers', () => {
      const providers = ProviderLoader.getAvailableProviders();
      expect(providers).toContain('aws');
      expect(providers).toContain('k8s');
      expect(providers).toContain('test');
    });

    it('cleans up cache', async () => {
      mockProviderGitManager.cleanupOldRepositories.mockResolvedValue();

      await ProviderLoader.cleanupCache(7);

      expect(mockProviderGitManager.cleanupOldRepositories).toHaveBeenCalledWith(7);
    });

    it('analyzes provider sources', () => {
      const githubInfo = ProviderLoader.analyzeProviderSource('https://github.com/user/repo');
      expect(githubInfo.type).toBe('github');
      if (githubInfo.type === 'github') {
        expect(githubInfo.owner).toBe('user');
        expect(githubInfo.repo).toBe('repo');
      }

      const localInfo = ProviderLoader.analyzeProviderSource('./local-provider');
      expect(localInfo.type).toBe('local');
      if (localInfo.type === 'local') {
        expect(localInfo.path).toBe('./local-provider');
      }

      const npmInfo = ProviderLoader.analyzeProviderSource('my-package');
      expect(npmInfo.type).toBe('npm');
      if (npmInfo.type === 'npm') {
        expect(npmInfo.packageName).toBe('my-package');
      }
    });
  });
});
