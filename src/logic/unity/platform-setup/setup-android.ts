import { path } from '../../../dependencies.ts';
import type { Options } from '../../../dependencies.ts';
import * as nodeFs from 'node:fs';

class SetupAndroid {
  public static async setup(options: Options) {
    const { targetPlatform, androidKeystoreBase64, androidKeystoreName, projectPath } = options;

    if (targetPlatform === 'Android' && androidKeystoreBase64 !== '' && androidKeystoreName !== '') {
      SetupAndroid.setupAndroidRun(androidKeystoreBase64, androidKeystoreName, projectPath);
    }
  }

  private static setupAndroidRun(androidKeystoreBase64: string, androidKeystoreName: string, projectPath: string) {
    const decodedKeystore = Uint8Array.from(atob(androidKeystoreBase64), c => c.charCodeAt(0));
    const githubWorkspace = process.env.GITHUB_WORKSPACE || '';
    nodeFs.writeFileSync(path.join(githubWorkspace, projectPath, androidKeystoreName), decodedKeystore);
  }
}

export { SetupAndroid };
