class UnityProject {
  static get libraryFolder() {
    return 'Library';
  }

  static getLibraryFolder(projectPath) {
    return `${projectPath}/${UnityProject.libraryFolder}`;
  }
}

export default UnityProject;
