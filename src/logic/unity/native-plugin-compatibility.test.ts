import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanForWindowsOnlyEditorPlugins } from './native-plugin-compatibility.ts';

// Real Unity PluginImporter serialization for a native plugin gated to
// Windows-hosted Editors only: platformData is an array of
// { first, second } pairs (Unity's own convention for a
// Dictionary<BuildTarget, PluginImporterPlatformData>), and the pair with
// first.Editor: Editor / second.settings.OS: Windows / second.enabled: 1 is
// exactly the one that makes the plugin invisible to a Linux-hosted Editor.
const WINDOWS_ONLY_EDITOR_META = `fileFormatVersion: 2
guid: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
PluginImporter:
  externalObjects: {}
  serializedVersion: 2
  iconMap: {}
  executionOrder: {}
  defineConstraints: []
  isPreloaded: 0
  isOverridable: 0
  isExplicitlyReferenced: 0
  validateReferences: 1
  platformData:
  - first:
      Any:
    second:
      enabled: 0
      settings: {}
  - first:
      Editor: Editor
      Windows: Windows
    second:
      enabled: 1
      settings:
        DefaultValueInitialized: true
        Exclude Editor: 0
        Exclude Linux64: 1
        Exclude OSXUniversal: 1
        Exclude Win: 0
        Exclude Win64: 0
        OS: Windows
  - first:
      Standalone: Win64
    second:
      enabled: 1
      settings:
        CPU: AnyCPU
  userData:
  assetBundleName:
  assetBundleVariant:
`;

// A plugin available on AnyOS / not gated to Windows-only Editor - should
// NOT be flagged.
const ANY_OS_META = `fileFormatVersion: 2
guid: b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5
PluginImporter:
  externalObjects: {}
  serializedVersion: 2
  iconMap: {}
  executionOrder: {}
  defineConstraints: []
  isPreloaded: 0
  isOverridable: 0
  isExplicitlyReferenced: 0
  validateReferences: 1
  platformData:
  - first:
      Editor: Editor
      Windows: Windows
    second:
      enabled: 1
      settings:
        DefaultValueInitialized: true
        OS: AnyOS
  - first:
      Standalone: Win64
    second:
      enabled: 1
      settings:
        CPU: AnyCPU
  userData:
  assetBundleName:
  assetBundleVariant:
`;

// A plugin gated to Editor, but not enabled - should NOT be flagged.
const DISABLED_WINDOWS_EDITOR_META = `fileFormatVersion: 2
guid: c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6
PluginImporter:
  serializedVersion: 2
  platformData:
  - first:
      Editor: Editor
      Windows: Windows
    second:
      enabled: 0
      settings:
        OS: Windows
  userData:
  assetBundleName:
  assetBundleVariant:
`;

// A non-plugin .meta file (e.g. a .cs.meta) - no PluginImporter key at all.
const SCRIPT_META = `fileFormatVersion: 2
guid: d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData:
  assetBundleName:
  assetBundleVariant:
`;

function makeTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'native-plugin-compat-'));
}

function writeFile(root: string, relativePath: string, contents: string): void {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents);
}

describe('scanForWindowsOnlyEditorPlugins', () => {
  let projectPath: string;

  afterEach(() => {
    if (projectPath) fs.rmSync(projectPath, { recursive: true, force: true });
  });

  it('flags a .dll.meta with a Windows-only Editor platformData entry', () => {
    projectPath = makeTempProject();
    writeFile(projectPath, 'Assets/Plugins/Windows/NativeThing.dll', 'binary-stand-in');
    writeFile(projectPath, 'Assets/Plugins/Windows/NativeThing.dll.meta', WINDOWS_ONLY_EDITOR_META);

    const result = scanForWindowsOnlyEditorPlugins(projectPath);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('Assets/Plugins/Windows/NativeThing.dll');
    expect(result[0].guid).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
  });

  it('does not flag a plugin available on AnyOS', () => {
    projectPath = makeTempProject();
    writeFile(projectPath, 'Assets/Plugins/CrossPlatform.dll', 'binary-stand-in');
    writeFile(projectPath, 'Assets/Plugins/CrossPlatform.dll.meta', ANY_OS_META);

    const result = scanForWindowsOnlyEditorPlugins(projectPath);

    expect(result).toHaveLength(0);
  });

  it('does not flag a Windows-gated Editor entry that is disabled', () => {
    projectPath = makeTempProject();
    writeFile(projectPath, 'Assets/Plugins/Disabled.dll', 'binary-stand-in');
    writeFile(projectPath, 'Assets/Plugins/Disabled.dll.meta', DISABLED_WINDOWS_EDITOR_META);

    const result = scanForWindowsOnlyEditorPlugins(projectPath);

    expect(result).toHaveLength(0);
  });

  it('ignores non-.dll.meta files entirely (e.g. .cs.meta, .png.meta)', () => {
    projectPath = makeTempProject();
    writeFile(projectPath, 'Assets/Scripts/Foo.cs', 'public class Foo {}');
    writeFile(projectPath, 'Assets/Scripts/Foo.cs.meta', SCRIPT_META);
    writeFile(projectPath, 'Assets/Textures/Icon.png', 'binary-stand-in');
    writeFile(projectPath, 'Assets/Textures/Icon.png.meta', SCRIPT_META);

    const result = scanForWindowsOnlyEditorPlugins(projectPath);

    expect(result).toHaveLength(0);
  });

  it('does not throw on a malformed or empty .meta file, and skips it', () => {
    projectPath = makeTempProject();
    writeFile(projectPath, 'Assets/Plugins/Broken.dll', 'binary-stand-in');
    writeFile(projectPath, 'Assets/Plugins/Broken.dll.meta', '{this is not: valid: yaml: [');
    writeFile(projectPath, 'Assets/Plugins/Empty.dll', 'binary-stand-in');
    writeFile(projectPath, 'Assets/Plugins/Empty.dll.meta', '');

    expect(() => scanForWindowsOnlyEditorPlugins(projectPath)).not.toThrow();
    expect(scanForWindowsOnlyEditorPlugins(projectPath)).toHaveLength(0);
  });

  it('returns an empty array when Assets does not exist', () => {
    projectPath = makeTempProject();

    expect(scanForWindowsOnlyEditorPlugins(projectPath)).toHaveLength(0);
  });

  it('scans recursively and can flag multiple plugins while skipping others', () => {
    projectPath = makeTempProject();
    writeFile(projectPath, 'Assets/Plugins/Windows/A.dll', 'a');
    writeFile(projectPath, 'Assets/Plugins/Windows/A.dll.meta', WINDOWS_ONLY_EDITOR_META);
    writeFile(projectPath, 'Assets/Plugins/Deep/Nested/Dir/B.dll', 'b');
    writeFile(projectPath, 'Assets/Plugins/Deep/Nested/Dir/B.dll.meta', WINDOWS_ONLY_EDITOR_META);
    writeFile(projectPath, 'Assets/Plugins/CrossPlatform.dll', 'c');
    writeFile(projectPath, 'Assets/Plugins/CrossPlatform.dll.meta', ANY_OS_META);
    writeFile(projectPath, 'Assets/Scripts/Foo.cs', 'public class Foo {}');
    writeFile(projectPath, 'Assets/Scripts/Foo.cs.meta', SCRIPT_META);

    const result = scanForWindowsOnlyEditorPlugins(projectPath);
    const paths = result.map((r) => r.path).sort();

    expect(paths).toEqual(['Assets/Plugins/Deep/Nested/Dir/B.dll', 'Assets/Plugins/Windows/A.dll']);
  });
});
