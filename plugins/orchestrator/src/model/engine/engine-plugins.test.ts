import { UnityPlugin } from './unity-plugin';
import { GodotPlugin } from './godot-plugin';
import { UnrealPlugin } from './unreal-plugin';
import { initEngine, getEngine, setEngine } from './index';

describe('Engine Plugins', () => {
  afterEach(() => {
    // Reset to default
    setEngine(UnityPlugin);
  });

  describe('GodotPlugin', () => {
    it('has correct name', () => {
      expect(GodotPlugin.name).toBe('godot');
    });

    it('has Godot cache folders', () => {
      expect(GodotPlugin.cacheFolders).toContain('.godot/imported');
      expect(GodotPlugin.cacheFolders).toContain('.godot/shader_cache');
    });

    it('has no preStop command', () => {
      expect(GodotPlugin.preStopCommand).toBeUndefined();
    });
  });

  describe('UnrealPlugin', () => {
    it('has correct name', () => {
      expect(UnrealPlugin.name).toBe('unreal');
    });

    it('has UE cache folders', () => {
      expect(UnrealPlugin.cacheFolders).toContain('Saved');
      expect(UnrealPlugin.cacheFolders).toContain('Intermediate');
      expect(UnrealPlugin.cacheFolders).toContain('DerivedDataCache');
    });

    it('has no preStop command', () => {
      expect(UnrealPlugin.preStopCommand).toBeUndefined();
    });
  });

  describe('initEngine', () => {
    it('initializes godot from built-in plugin', () => {
      initEngine('godot');
      expect(getEngine().name).toBe('godot');
    });

    it('initializes unreal from built-in plugin', () => {
      initEngine('unreal');
      expect(getEngine().name).toBe('unreal');
    });

    it('initializes unity from built-in plugin', () => {
      initEngine('unity');
      expect(getEngine().name).toBe('unity');
    });

    it('throws for unknown engine without plugin source', () => {
      expect(() => initEngine('custom-engine')).toThrow('requires an enginePlugin source');
    });
  });
});
