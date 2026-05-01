type EnvVariables = { [index: string]: string };

export class Environment implements EnvVariables {
  public readonly os: string;
  public readonly arch: string;

  [key: string]: string;

  constructor(env: NodeJS.ProcessEnv, envFile: EnvVariables) {
    // Make an immutable copy of the environment variables.
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        console.error(`Environment variable ${key} is undefined.`);
        continue;
      }

      this[key] = value;
    }

    // Override any env variables that are set in a .env file.
    for (const [key, value] of Object.entries(envFile)) {
      this[key] = value;
    }

    // Override specific variables.
    this.os = process.platform;
    this.arch = process.arch;
  }

  public get(key: string): string | undefined {
    return this[key];
  }

  public getOS(): string {
    return this.os;
  }

  public getArch(): string {
    return this.arch;
  }
}
