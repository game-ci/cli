import { fsSync, Options } from '../../../dependencies.ts';
import UnityProject from '../../../model/unity/project/unity-project.ts';

class CacheValidation {
  static verify(options: Options) {
    const { projectPath, isRunningLocally } = options;

    if (isRunningLocally) return;

    if (!fsSync.existsSync(UnityProject.getLibraryFolder(projectPath))) {
      log.warning(String.dedent`
        Library folder does not exist.

        Consider setting up caching to speed up your workflow if this is not your first build.
      `);
    }
  }
}

export default CacheValidation;
