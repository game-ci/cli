import { UnityProject } from './unity-project.ts';

describe('Project', () => {
  describe('libraryFolder', () => {
    it('does not throw', () => {
      expect(() => UnityProject.libraryFolder).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof UnityProject.libraryFolder).toStrictEqual('string');
    });
  });

  describe('getLibraryFolder', () => {
    it('returns a string', () => {
      expect(typeof UnityProject.getLibraryFolder('.')).toStrictEqual('string');
    });

    it('includes the project path', () => {
      expect(UnityProject.getLibraryFolder('./test-project')).toContain('test-project');
    });
  });
});
