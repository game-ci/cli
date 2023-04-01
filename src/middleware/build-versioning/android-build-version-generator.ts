import { semver } from '../../dependencies.ts';

export default class AndroidBuildVersionGenerator {
  public static determineVersionCode(version: string) {
    if (version === 'none') {
      log.info(`Versioning strategy is set to ${version}, so android version code should not be applied.`);

      return 0;
    }

    const parsedVersion = semver.parse(version);

    if (!parsedVersion) {
      log.warning(`Could not parse "${version}" to semver, defaulting android version code to 1`);

      return 1;
    }

    // The greatest value Google Plays allows is 2100000000.
    // Allow for 3 patch digits, 3 minor digits and 3 major digits.
    const versionCode = parsedVersion.major * 1_000_000 + parsedVersion.minor * 1000 + parsedVersion.patch;

    if (versionCode >= 2_050_000_000) {
      throw new Error(
        `Generated versionCode ${versionCode} is dangerously close to the maximum allowed number 2100000000. Consider a different versioning scheme to be able to continue updating your application.`,
      );
    }
    log.info(`Using android versionCode ${versionCode}`);

    return versionCode;
  }
}
