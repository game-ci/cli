import { Options, path } from '../../../dependencies.ts';

class SetupAndroid {
  public static async setup(options: Options) {
    const { targetPlatform, androidKeystoreBase64, androidKeystoreName, projectPath } = options;

    if (targetPlatform === 'Android' && androidKeystoreBase64 !== '' && androidKeystoreName !== '') {
      SetupAndroid.setupAndroidRun(androidKeystoreBase64, androidKeystoreName, projectPath);
    }
  }

  private static setupAndroidRun(androidKeystoreBase64: string, androidKeystoreName: string, projectPath: string) {
    const decodedKeystore = Uint8Array.from(atob(androidKeystoreBase64), c => c.charCodeAt(0));
    const githubWorkspace = Deno.env.get('GITHUB_WORKSPACE') || '';
    Deno.writeFileSync(path.join(githubWorkspace, projectPath, androidKeystoreName), decodedKeystore);
  }
}

export default SetupAndroid;
