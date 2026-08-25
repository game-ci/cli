import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the generic plugin loader (plugin.ts).
 *
 * The default plugin implementation is currently @game-ci/orchestrator, but
 * unity-builder depends on the generic Plugin lifecycle rather than an
 * orchestrator-specific type.
 */

const mockWarning = vi.fn();
const mockInfo = vi.fn();
vi.mock('@actions/core', () => ({
  warning: mockWarning,
  info: mockInfo,
}));

beforeEach(() => {
  vi.resetModules();
  mockWarning.mockClear();
  mockInfo.mockClear();
});

describe('plugin (default package not installed)', () => {
  it('loadPlugin() returns undefined', async () => {
    const { loadPlugin } = await import('./plugin');

    const result = await loadPlugin();

    expect(result).toBeUndefined();
  });
});

describe('plugin (default package installed)', () => {
  const fakePlugin = {
    initialize: vi.fn(),
    canHandleBuild: vi.fn().mockReturnValue(false),
    handleBuild: vi.fn().mockResolvedValue({ exitCode: 0 }),
    beforeLocalBuild: vi.fn(),
    afterLocalBuild: vi.fn(),
    handlePostBuild: vi.fn(),
  };

  const mockCreatePlugin = vi.fn().mockReturnValue(fakePlugin);

  const FIXTURE_MODULE = './__fixtures__/fake-orchestrator-plugin';

  function installDefaultPluginMock(overrides: Record<string, unknown> = {}) {
    // `@game-ci/orchestrator` is intentionally optional and, in this CI job,
    // genuinely unbuilt/unresolvable (no dist/, not a real dependency here) -
    // vi.doMock'ing that bare specifier directly fails at real module
    // resolution before the mock factory ever runs. Mock a real, on-disk
    // fixture file instead (its own content is irrelevant, only its
    // resolvability matters) and pass it to loadPlugin() explicitly.
    vi.doMock(FIXTURE_MODULE, () => ({
      createPlugin: mockCreatePlugin,
      ...overrides,
    }));
  }

  beforeEach(() => {
    mockCreatePlugin.mockClear();
    fakePlugin.initialize.mockClear();
    fakePlugin.canHandleBuild.mockClear();
    fakePlugin.handleBuild.mockClear();
    fakePlugin.beforeLocalBuild.mockClear();
    fakePlugin.afterLocalBuild.mockClear();
    fakePlugin.handlePostBuild.mockClear();
  });

  it('returns the plugin from createPlugin()', async () => {
    installDefaultPluginMock();
    const { loadPlugin } = await import('./plugin');

    const plugin = await loadPlugin(FIXTURE_MODULE);

    expect(plugin).toBeDefined();
    expect(mockCreatePlugin).toHaveBeenCalledTimes(1);
    expect(plugin).toBe(fakePlugin);
  });

  it('returns a plugin with all lifecycle methods', async () => {
    installDefaultPluginMock();
    const { loadPlugin } = await import('./plugin');

    const plugin = await loadPlugin(FIXTURE_MODULE);

    expect(typeof plugin!.initialize).toBe('function');
    expect(typeof plugin!.canHandleBuild).toBe('function');
    expect(typeof plugin!.handleBuild).toBe('function');
    expect(typeof plugin!.beforeLocalBuild).toBe('function');
    expect(typeof plugin!.afterLocalBuild).toBe('function');
    expect(typeof plugin!.handlePostBuild).toBe('function');
  });

  it('returns undefined and warns when createPlugin is not a function', async () => {
    installDefaultPluginMock({ createPlugin: undefined });
    const { loadPlugin } = await import('./plugin');

    const plugin = await loadPlugin(FIXTURE_MODULE);

    expect(plugin).toBeUndefined();
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('does not export createPlugin'),
    );
  });

  it('propagates non-MODULE_NOT_FOUND errors', async () => {
    // Throw lazily from `createPlugin` rather than from the mock factory
    // itself: vitest 4 wraps factory-time errors with its own message, which
    // masks the inner error at the assertion site.
    installDefaultPluginMock({
      createPlugin: () => {
        throw new Error('Syntax error in module');
      },
    });
    const { loadPlugin } = await import('./plugin');

    await expect(loadPlugin(FIXTURE_MODULE)).rejects.toThrow('Syntax error in module');
  });
});
