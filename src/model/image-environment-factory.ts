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
  public static getEnvVarString(options: Options, extraVariables: DockerParameter[] = []) {
    const { hostOS } = options;
    const environmentVariables = ImageEnvironmentFactory.getEnvironmentVariables(options, extraVariables);
    const lineContinuation = hostOS === 'windows' ? '`' : '\\';
    const lines: string[] = [];
    for (const p of environmentVariables) {
      if (p.value === '' || p.value === undefined) {
        continue;
      }
      if (p.name !== 'ANDROID_KEYSTORE_BASE64' && p.value.toString().includes(`\n`)) {
        // Bare `--env NAME` makes the docker client inherit the value from its
        // own process environment, which keeps a multiline blob (a .ulf's XML)
        // out of the command string. That only works when the value actually
        // is in process.env: pass `--unityLicense <path>` instead of the
        // UNITY_LICENSE env var and the coercer in unity-options.ts reads the
        // file off disk, so nothing ever set process.env.UNITY_LICENSE and the
        // variable arrived *empty* in the container - activation then failed
        // with Unity's generic licensing errors rather than anything pointing
        // at the real cause. Export it here so both routes behave the same.
        if (process.env[p.name] === undefined) {
          process.env[p.name] = p.value.toString();
        }
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
