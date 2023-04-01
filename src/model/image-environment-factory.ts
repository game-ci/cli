import { Options } from '../dependencies.ts';

class DockerParameter {
  public name!: string;
  public value!: string;
}

class ImageEnvironmentFactory {
  public static getEnvVarString(options: Options) {
    const { hostOS } = options;
    const environmentVariables = ImageEnvironmentFactory.getEnvironmentVariables(options);
    let string = '';
    for (const p of environmentVariables) {
      if (p.value === '' || p.value === undefined) {
        continue;
      }
      if (p.name !== 'ANDROID_KEYSTORE_BASE64' && p.value.toString().includes(`\n`)) {
        string += `--env ${p.name} `;
        continue;
      }

      if (hostOS === 'windows') {
        // The ampersand (&) character is not allowed. The & operator is reserved for future use; wrap an ampersand in
        // double quotation marks ("&") to pass it as part of a string.
        const escapedValue = typeof p.value !== 'string' ? p.value : p.value?.replace(/&/, '\\"&\\"');
        string += `--env ${p.name}='${escapedValue}' \`\n`;
      } else {
        string += `--env ${p.name}="${p.value}"\n`;
      }
    }

    if (hostOS === 'windows') {
      string = string.replace(/`\n$/, '');
    } else {
      string = string.replace(/\n$/, '');
    }

    return string;
  }
  public static getEnvironmentVariables(options: Options) {
    // Todo - replace with simple for of loop, mapping parameters to this specific format
    // All parameters should be straight forward at this point in the process.
    // We can convert between camelCase and UPPER_SNAKE_CASE relatively easily.
    const environmentVariables: DockerParameter[] = [
      { name: 'UNITY_LICENSE', value: options.unityLicense },
      { name: 'UNITY_LICENSE_FILE', value: options.unityLicenseFile },
      { name: 'UNITY_EMAIL', value: options.unityEmail },
      { name: 'UNITY_PASSWORD', value: options.unityPassword },
      { name: 'UNITY_SERIAL', value: options.unitySerial },
      { name: 'UNITY_LICENSING_SERVER', value: options.unityLicensingServer },
      { name: 'UNITY_VERSION', value: options.engineVersion },
      { name: 'USYM_UPLOAD_AUTH_TOKEN', value: options.uploadAuthToken },
      { name: 'PROJECT_PATH', value: options.projectPath },
      { name: 'BUILD_TARGET', value: options.targetPlatform },
      { name: 'BUILD_NAME', value: options.buildName },
      { name: 'BUILD_PATH', value: options.buildPath },
      { name: 'BUILD_FILE', value: options.buildFile },
      { name: 'BUILD_METHOD', value: options.buildMethod },
      { name: 'VERSION', value: options.buildVersion },
      { name: 'ANDROID_VERSION_CODE', value: options.androidVersionCode },
      { name: 'ANDROID_KEYSTORE_NAME', value: options.androidKeystoreName },
      { name: 'ANDROID_KEYSTORE_BASE64', value: options.androidKeystoreBase64 },
      { name: 'ANDROID_KEYSTORE_PASS', value: options.androidKeystorePass },
      { name: 'ANDROID_KEYALIAS_NAME', value: options.androidKeyaliasName },
      { name: 'ANDROID_KEYALIAS_PASS', value: options.androidKeyaliasPass },
      { name: 'ANDROID_TARGET_SDK_VERSION', value: options.androidTargetSdkVersion },
      { name: 'ANDROID_SDK_MANAGER_PARAMETERS', value: options.androidSdkManagerParameters },
      { name: 'CUSTOM_PARAMETERS', value: options.customParameters },
      { name: 'CHOWN_FILES_TO', value: options.chownFilesTo },
      { name: 'GITHUB_REF', value: Deno.env.get('GITHUB_REF') },
      { name: 'GITHUB_SHA', value: Deno.env.get('GITHUB_SHA') },
      { name: 'GITHUB_REPOSITORY', value: Deno.env.get('GITHUB_REPOSITORY') },
      { name: 'GITHUB_ACTOR', value: Deno.env.get('GITHUB_ACTOR') },
      { name: 'GITHUB_WORKFLOW', value: Deno.env.get('GITHUB_WORKFLOW') },
      { name: 'GITHUB_HEAD_REF', value: Deno.env.get('GITHUB_HEAD_REF') },
      { name: 'GITHUB_BASE_REF', value: Deno.env.get('GITHUB_BASE_REF') },
      { name: 'GITHUB_EVENT_NAME', value: Deno.env.get('GITHUB_EVENT_NAME') },
      { name: 'GITHUB_ACTION', value: Deno.env.get('GITHUB_ACTION') },
      { name: 'GITHUB_EVENT_PATH', value: Deno.env.get('GITHUB_EVENT_PATH') },
      { name: 'RUNNER_OS', value: Deno.env.get('RUNNER_OS') },
      { name: 'RUNNER_TOOL_CACHE', value: Deno.env.get('RUNNER_TOOL_CACHE') },
      { name: 'RUNNER_TEMP', value: Deno.env.get('RUNNER_TEMP') },
      { name: 'RUNNER_WORKSPACE', value: Deno.env.get('RUNNER_WORKSPACE') },
    ];
    if (options.sshAgent) environmentVariables.push({ name: 'SSH_AUTH_SOCK', value: '/ssh-agent' });

    return environmentVariables;
  }
}

export default ImageEnvironmentFactory;
