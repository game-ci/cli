import Parameters from './parameters.ts';
import { ReadLicense } from './input-readers/test-license-reader.ts';

class Parameter {
  public name;
  public value;
}

class ImageEnvironmentFactory {
  public static getEnvVarString(options) {
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
  public static getEnvironmentVariables(parameters: Parameters) {
    // Todo - replace with simple for of loop, mapping parameters to this specific format
    // All parameters should be straight forward at this point in the process.
    // We can convert between camelCase and UPPER_SNAKE_CASE relatively easily.
    const environmentVariables: Parameter[] = [
      { name: 'UNITY_LICENSE', value: parameters.unityLicense || ReadLicense(parameters) },
      { name: 'UNITY_LICENSE_FILE', value: parameters.unityLicenseFile },
      { name: 'UNITY_EMAIL', value: parameters.unityEmail },
      { name: 'UNITY_PASSWORD', value: parameters.unityPassword },
      { name: 'UNITY_SERIAL', value: parameters.unitySerial },
      { name: 'UNITY_VERSION', value: parameters.engineVersion },
      { name: 'USYM_UPLOAD_AUTH_TOKEN', value: parameters.uploadAuthToken },
      { name: 'PROJECT_PATH', value: parameters.projectPath },
      { name: 'BUILD_TARGET', value: parameters.targetPlatform },
      { name: 'BUILD_NAME', value: parameters.buildName },
      { name: 'BUILD_PATH', value: parameters.buildPath },
      { name: 'BUILD_FILE', value: parameters.buildFile },
      { name: 'BUILD_METHOD', value: parameters.buildMethod },
      { name: 'VERSION', value: parameters.buildVersion },
      { name: 'ANDROID_VERSION_CODE', value: parameters.androidVersionCode },
      { name: 'ANDROID_KEYSTORE_NAME', value: parameters.androidKeystoreName },
      { name: 'ANDROID_KEYSTORE_BASE64', value: parameters.androidKeystoreBase64 },
      { name: 'ANDROID_KEYSTORE_PASS', value: parameters.androidKeystorePass },
      { name: 'ANDROID_KEYALIAS_NAME', value: parameters.androidKeyaliasName },
      { name: 'ANDROID_KEYALIAS_PASS', value: parameters.androidKeyaliasPass },
      { name: 'ANDROID_TARGET_SDK_VERSION', value: parameters.androidTargetSdkVersion },
      { name: 'ANDROID_SDK_MANAGER_PARAMETERS', value: parameters.androidSdkManagerParameters },
      { name: 'CUSTOM_PARAMETERS', value: parameters.customParameters },
      { name: 'CHOWN_FILES_TO', value: parameters.chownFilesTo },
      { name: 'GITHUB_REF', value: Deno.env.get('GITHUB_REF') },
      { name: 'GITHUB_SHA', value: Deno.env.get('GITHUB_SHA') },
      { name: 'GITHUB_REPOSITORY', value: Deno.env.get('GITHUB_REPOSITORY') },
      { name: 'GITHUB_ACTOR', value: Deno.env.get('GITHUB_ACTOR') },
      { name: 'GITHUB_WORKFLOW', value: Deno.env.get('GITHUB_WORKFLOW') },
      { name: 'GITHUB_HEAD_REF', value: Deno.env.get('GITHUB_HEAD_REF') },
      { name: 'GITHUB_BASE_REF', value: Deno.env.get('GITHUB_BASE_REF') },
      { name: 'GITHUB_EVENT_NAME', value: Deno.env.get('GITHUB_EVENT_NAME') },
      { name: 'GITHUB_WORKSPACE', value: '/github/workspace' },
      { name: 'GITHUB_ACTION', value: Deno.env.get('GITHUB_ACTION') },
      { name: 'GITHUB_EVENT_PATH', value: Deno.env.get('GITHUB_EVENT_PATH') },
      { name: 'RUNNER_OS', value: Deno.env.get('RUNNER_OS') },
      { name: 'RUNNER_TOOL_CACHE', value: Deno.env.get('RUNNER_TOOL_CACHE') },
      { name: 'RUNNER_TEMP', value: Deno.env.get('RUNNER_TEMP') },
      { name: 'RUNNER_WORKSPACE', value: Deno.env.get('RUNNER_WORKSPACE') },
    ];
    if (parameters.sshAgent) environmentVariables.push({ name: 'SSH_AUTH_SOCK', value: '/ssh-agent' });

    return environmentVariables;
  }
}

export default ImageEnvironmentFactory;
