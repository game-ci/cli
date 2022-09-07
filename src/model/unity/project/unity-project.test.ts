import UnityProject from './unity-project.ts';

describe('Project', () => {
  describe('libraryFolder', () => {
    it('does not throw', () => {
      expect(() => UnityProject.libraryFolder).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof UnityProject.libraryFolder).toStrictEqual('string');
    });
  });

  describe('relativePath', () => {
    it('does not throw', () => {
      expect(() => UnityProject.relativePath).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof UnityProject.relativePath).toStrictEqual('string');
    });
  });

  describe('absolutePath', () => {
    it('does not throw', () => {
      expect(() => UnityProject.absolutePath).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof UnityProject.absolutePath).toStrictEqual('string');
    });
  });

  describe('libraryFolder', () => {
    it('does not throw', () => {
      expect(() => UnityProject.getLibraryFolder).not.toThrow();
    });

    it('returns a string', () => {
      expect(typeof UnityProject.getLibraryFolder).toStrictEqual('string');
    });
  });
});
