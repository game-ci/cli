import { UnrealProjectDetector } from './unreal-project-detector.ts';
import * as path from 'node:path';

describe('UnrealProjectDetector', () => {
  describe('isUnrealProject', () => {
    it('returns true for an Unreal project', () => {
      const projectPath = path.resolve(__dirname, '../../../test-projects/unreal-minimal');
      expect(UnrealProjectDetector.isUnrealProject(projectPath)).toBe(true);
    });

    it('returns false for a non-Unreal directory', () => {
      expect(UnrealProjectDetector.isUnrealProject('/tmp/nonexistent')).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses engine version from .uproject JSON', () => {
      const content = JSON.stringify({
        FileVersion: 3,
        EngineAssociation: '5.4',
        Modules: [],
      });
      expect(UnrealProjectDetector.parse(content)).toBe('5.4');
    });

    it('parses engine version 5.3', () => {
      const content = JSON.stringify({ EngineAssociation: '5.3' });
      expect(UnrealProjectDetector.parse(content)).toBe('5.3');
    });

    it('throws for content without EngineAssociation', () => {
      expect(() => UnrealProjectDetector.parse('{}')).toThrow();
    });
  });

  describe('getUnrealVersion', () => {
    it('returns the version from the test project', () => {
      const projectPath = path.resolve(__dirname, '../../../test-projects/unreal-minimal');
      expect(UnrealProjectDetector.getUnrealVersion(projectPath)).toBe('5.4');
    });
  });
});
