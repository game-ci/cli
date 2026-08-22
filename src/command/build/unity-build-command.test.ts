import { describe, it, expect, mock, afterEach, beforeAll, afterAll } from 'bun:test';
import { Docker } from '../../model/index.ts';
import { MacBuilder } from '../../model/mac-builder.ts';
import { PlatformSetup } from '../../logic/unity/platform-setup/index.ts';
import { PlatformValidation } from '../../logic/unity/platform-validation/platform-validation.ts';
import { CacheValidation } from '../../model/index.ts';

const NATIVE_PLUGIN_COMPAT_MODULE_PATH = '../../logic/unity/native-plugin-compatibility.ts';

// Named-export bindings imported directly (as UnityBuildCommand.ts does:
// `import { scanForWindowsOnlyEditorPlugins } from '...'`) are read-only at
// the call site - reassigning them from a test throws "Attempted to assign
// to readonly property." bun:test's mock.module replaces the whole module
// in the module registry instead, which UnityBuildCommand.ts's own import
// then resolves through - as long as the mock is installed before
// UnityBuildCommand.ts is first imported anywhere in this test run.
//
// mock.module patches the module registry process-wide (bun runs all test
// files in one process), so it would otherwise leak into
// native-plugin-compatibility.test.ts, which exercises the real
// implementation - capture that real implementation first and restore it
// in afterAll so this file's mock doesn't outlive its own tests.
const realNativePluginCompatibility = await import(NATIVE_PLUGIN_COMPAT_MODULE_PATH);
const realScan = realNativePluginCompatibility.scanForWindowsOnlyEditorPlugins;

const scanMock = mock((..._args: unknown[]) => [] as { path: string; guid?: string }[]);
mock.module(NATIVE_PLUGIN_COMPAT_MODULE_PATH, () => ({
  scanForWindowsOnlyEditorPlugins: scanMock,
}));

const originalDockerRun = Docker.run;
const originalMacBuilderRun = MacBuilder.run;
const originalPlatformSetup = PlatformSetup.setup;
const originalCheckCompatibility = PlatformValidation.checkCompatibility;
const originalCacheVerify = CacheValidation.verify;
let originalLogWarning: ((msg: any, ...args: any[]) => void) | undefined;
let warningMock: ReturnType<typeof mock>;

beforeAll(() => {
  originalLogWarning = (globalThis as any).log?.warning;
});

afterEach(() => {
  Docker.run = originalDockerRun;
  MacBuilder.run = originalMacBuilderRun;
  PlatformSetup.setup = originalPlatformSetup;
  PlatformValidation.checkCompatibility = originalCheckCompatibility;
  CacheValidation.verify = originalCacheVerify;
  scanMock.mockClear();
  scanMock.mockReset();
  scanMock.mockImplementation(() => []);
  if (originalLogWarning) (globalThis as any).log.warning = originalLogWarning;
});

afterAll(() => {
  if (originalLogWarning) (globalThis as any).log.warning = originalLogWarning;
  mock.module(NATIVE_PLUGIN_COMPAT_MODULE_PATH, () => ({
    scanForWindowsOnlyEditorPlugins: realScan,
  }));
});

const baseOptions = {
  hostPlatform: 'linux',
  hostOS: 'linux',
  engine: 'unity',
  engineVersion: '2022.3.20f1',
  targetPlatform: 'StandaloneLinux64',
  projectPath: '/tmp/some-project',
} as any;

function stubCollaborators() {
  PlatformValidation.checkCompatibility = mock(() => {});
  CacheValidation.verify = mock(() => {});
  PlatformSetup.setup = mock(() => Promise.resolve());
  Docker.run = mock(() => Promise.resolve());
  MacBuilder.run = mock(() => Promise.resolve());
  warningMock = mock(() => {});
  (globalThis as any).log.warning = warningMock;
}

describe('UnityBuildCommand native plugin compatibility warning', () => {
  it('warns when the scan finds Windows-only Editor plugins, on the Linux Docker path', async () => {
    stubCollaborators();
    scanMock.mockImplementation(() => [{ path: 'Assets/Plugins/Windows/NativeThing.dll', guid: 'abc123' }]);

    const { UnityBuildCommand } = await import('./unity-build-command.ts');
    const command = new UnityBuildCommand('build');
    await command.execute({ ...baseOptions });

    expect(scanMock).toHaveBeenCalledWith('/tmp/some-project');
    expect(warningMock).toHaveBeenCalled();
    const warned = warningMock.mock.calls.map((call) => String(call[0])).join('\n');
    expect(warned).toContain('native-plugin-compatibility');
    expect(warned).toContain('Assets/Plugins/Windows/NativeThing.dll');
  });

  it('does not warn when the scan finds nothing', async () => {
    stubCollaborators();
    scanMock.mockImplementation(() => []);

    const { UnityBuildCommand } = await import('./unity-build-command.ts');
    const command = new UnityBuildCommand('build');
    await command.execute({ ...baseOptions });

    expect(scanMock).toHaveBeenCalled();
    expect(warningMock).not.toHaveBeenCalled();
  });

  it('does not run the scan at all when --skipNativePluginCheck is set', async () => {
    stubCollaborators();
    scanMock.mockImplementation(() => [{ path: 'Assets/Plugins/Windows/NativeThing.dll' }]);

    const { UnityBuildCommand } = await import('./unity-build-command.ts');
    const command = new UnityBuildCommand('build');
    await command.execute({ ...baseOptions, skipNativePluginCheck: true });

    expect(scanMock).not.toHaveBeenCalled();
    expect(warningMock).not.toHaveBeenCalled();
  });

  it('does not run the scan on the Windows Docker container path', async () => {
    stubCollaborators();
    scanMock.mockImplementation(() => [{ path: 'Assets/Plugins/Windows/NativeThing.dll' }]);

    const { UnityBuildCommand } = await import('./unity-build-command.ts');
    const command = new UnityBuildCommand('build');
    await command.execute({ ...baseOptions, hostPlatform: 'win32', hostOS: 'windows' });

    expect(scanMock).not.toHaveBeenCalled();
  });

  it('does not run the scan on the macOS (MacBuilder) path', async () => {
    stubCollaborators();
    scanMock.mockImplementation(() => [{ path: 'Assets/Plugins/Windows/NativeThing.dll' }]);

    const { UnityBuildCommand } = await import('./unity-build-command.ts');
    const command = new UnityBuildCommand('build');
    await command.execute({ ...baseOptions, hostPlatform: 'darwin', hostOS: 'darwin' });

    expect(scanMock).not.toHaveBeenCalled();
  });
});
