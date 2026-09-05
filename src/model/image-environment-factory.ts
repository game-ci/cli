import type { Options } from '../dependencies.ts';

class DockerParameter {
  public name!: string;
  public value!: string;
}

class ImageEnvironmentFactory {
  /**
   * @param extraVariables Engine-supplied env vars (e.g. Unity's
   * UNITY_LICENSE/ANDROID_* set — see src/logic/unity/environment.ts) to
   * merge in alongside the generic/engine-agnostic ones below. Omit for
   * engines (Godot, Unreal) that don't have their own env var set yet.
   */
  /**
   * Multiline values are emitted as a bare `--env NAME`, so the docker client
   * takes the value from its own environment rather than the command string -
   * which is what keeps a .ulf's XML blob out of the logged command.
   *
   * ANDROID_KEYSTORE_BASE64 is excluded: it is already single-line base64, and
   * inlining it is the established behaviour.
   */
  private static isInheritedByName(p: DockerParameter): boolean {
    return p.name !== 'ANDROID_KEYSTORE_BASE64' && String(p.value).includes(`\n`);
  }

  /**
   * The values behind those bare `--env NAME` flags, to hand to the docker
   * client as its own process environment.
   *
   * Inheritance only works if the value is actually in the child's env. When
   * it came from `--unityLicense <path>`, the coercer in unity-options.ts read
   * it off disk and nothing ever put it in the environment, so UNITY_LICENSE
   * arrived *empty* in the container and activation failed with Unity's
   * generic licensing error rather than anything pointing at the cause.
   *
   * Returned per call rather than written into process.env: mutating the
   * process would make a second invocation with a different license silently
   * reuse the first one's value.
   */
  public static getInheritedEnvVars(options: Options, extraVariables: DockerParameter[] = []): Record<string, string> {
    const inherited: Record<string, string> = {};

    for (const p of ImageEnvironmentFactory.getEnvironmentVariables(options, extraVariables)) {
      if (p.value === '' || p.value === undefined) continue;
      if (!ImageEnvironmentFactory.isInheritedByName(p)) continue;

      inherited[p.name] = String(p.value);
    }

    return inherited;
  }

  public static getEnvVarString(options: Options, extraVariables: DockerParameter[] = []) {
    const { hostOS } = options;
    const environmentVariables = ImageEnvironmentFactory.getEnvironmentVariables(options, extraVariables);
    const lineContinuation = hostOS === 'windows' ? '`' : '\\';
    const lines: string[] = [];
    for (const p of environmentVariables) {
      if (p.value === '' || p.value === undefined) {
        continue;
      }
      if (ImageEnvironmentFactory.isInheritedByName(p)) {
        lines.push(`--env ${p.name}`);
        continue;
      }

      if (hostOS === 'windows') {
        // The ampersand (&) character is not allowed. The & operator is reserved for future use; wrap an ampersand in
        // double quotation marks ("&") to pass it as part of a string.
        const escapedValue = typeof p.value !== 'string' ? p.value : p.value?.replace(/&/, '\\"&\\"');
        lines.push(`--env ${p.name}='${escapedValue}'`);
      } else {
        lines.push(`--env ${p.name}="${p.value}"`);
      }
    }

    return lines.join(` ${lineContinuation}\n`);
  }

  /** Engine-agnostic env vars — apply to any engine's Docker build, not Unity-specific. */
  public static getEnvironmentVariables(options: Options, extraVariables: DockerParameter[] = []) {
    const environmentVariables: DockerParameter[] = [
      ...extraVariables,
      { name: 'PROJECT_PATH', value: options.projectPath },
      { name: 'BUILD_TARGET', value: options.targetPlatform },
      { name: 'BUILD_NAME', value: options.buildName },
      { name: 'BUILD_PATH', value: options.buildPath },
      { name: 'BUILD_FILE', value: options.buildFile },
      { name: 'BUILD_METHOD', value: options.buildMethod },
      { name: 'VERSION', value: options.buildVersion },
      { name: 'CUSTOM_PARAMETERS', value: options.customParameters },
      { name: 'CHOWN_FILES_TO', value: options.chownFilesTo },
      { name: 'GITHUB_REF', value: process.env.GITHUB_REF },
      { name: 'GITHUB_SHA', value: process.env.GITHUB_SHA },
      { name: 'GITHUB_REPOSITORY', value: process.env.GITHUB_REPOSITORY },
      { name: 'GITHUB_ACTOR', value: process.env.GITHUB_ACTOR },
      { name: 'GITHUB_WORKFLOW', value: process.env.GITHUB_WORKFLOW },
      { name: 'GITHUB_HEAD_REF', value: process.env.GITHUB_HEAD_REF },
      { name: 'GITHUB_BASE_REF', value: process.env.GITHUB_BASE_REF },
      { name: 'GITHUB_EVENT_NAME', value: process.env.GITHUB_EVENT_NAME },
      { name: 'GITHUB_ACTION', value: process.env.GITHUB_ACTION },
      { name: 'GITHUB_EVENT_PATH', value: process.env.GITHUB_EVENT_PATH },
      { name: 'RUNNER_OS', value: process.env.RUNNER_OS },
      { name: 'RUNNER_TOOL_CACHE', value: process.env.RUNNER_TOOL_CACHE },
      { name: 'RUNNER_TEMP', value: process.env.RUNNER_TEMP },
      { name: 'RUNNER_WORKSPACE', value: process.env.RUNNER_WORKSPACE },
    ];
    if (options.sshAgent) environmentVariables.push({ name: 'SSH_AUTH_SOCK', value: '/ssh-agent' });

    return environmentVariables;
  }
}

export { ImageEnvironmentFactory, DockerParameter };
