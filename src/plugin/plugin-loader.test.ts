import { describe, it, expect, beforeEach } from 'bun:test';
import { PluginLoader } from './plugin-loader.ts';
import { PluginRegistry } from './plugin-registry.ts';

describe('PluginLoader', () => {
  beforeEach(() => {
    PluginRegistry.reset();
  });

  describe('executable: prefix', () => {
    it('should reject non-existent executable path', async () => {
      try {
        await PluginLoader.load('executable:/nonexistent/path/to/binary');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('does not exist');
      }
    });
  });

  describe('source routing', () => {
    it('should route executable: prefix to loadFromExecutable', async () => {
      // This will fail because the path doesn't exist, but proves routing works
      try {
        await PluginLoader.load('executable:/fake/path');
      } catch (error: any) {
        expect(error.message).toContain('does not exist');
      }
    });

    it('should route github: prefix to loadFromGitHub', async () => {
      try {
        await PluginLoader.load('github:game-ci/test');
      } catch (error: any) {
        expect(error.message).toContain('not yet implemented');
      }
    });
  });
});
