import { GodotVersionDetector } from './godot-version-detector.ts';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../test-projects/godot-minimal',
);

describe('GodotVersionDetector', () => {
  describe('isGodotProject', () => {
    it('returns true for a Godot project', () => {
      expect(GodotVersionDetector.isGodotProject(fixtureRoot)).toBe(true);
    });

    it('returns false for a non-Godot directory', () => {
      expect(GodotVersionDetector.isGodotProject('/tmp/nonexistent')).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses version from PackedStringArray format', () => {
      const content = `
[application]
config/name="Test"
config/features=PackedStringArray("4.3")
`;
      expect(GodotVersionDetector.parse(content)).toBe('4.3');
    });

    it('parses version 4.2', () => {
      const content = `config/features=PackedStringArray("4.2", "GL Compatibility")`;
      expect(GodotVersionDetector.parse(content)).toBe('4.2');
    });

    it('throws for content without version', () => {
      expect(() => GodotVersionDetector.parse('[application]\nconfig/name="Test"')).toThrow();
    });
  });

  describe('getGodotVersion', () => {
    it('returns the version from the test project', () => {
      expect(GodotVersionDetector.getGodotVersion(fixtureRoot)).toBe('4.3');
    });
  });
});
