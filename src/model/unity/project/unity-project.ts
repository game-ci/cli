class UnityProject {
  static get libraryFolder() {
    return 'Library';
  }

  static getLibraryFolder(projectPath: string) {
    return `${projectPath}/${UnityProject.libraryFolder}`;
  }
}

export default UnityProject;
