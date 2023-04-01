import BuildVersionGenerator from './build-version-generator.ts';
import AndroidBuildVersionGenerator from './android-build-version-generator.ts';
import { Options } from "../../dependencies.ts";

export const buildVersioning = async (argv: Options) => {
  const { projectPath, currentBranch, versioningStrategy, version, allowDirtyBuild, androidVersionCode, buildVersion } = argv;

  const buildVersionGenerator = new BuildVersionGenerator(projectPath, currentBranch);

  argv.buildVersion = await buildVersionGenerator.determineBuildVersion(versioningStrategy, version, allowDirtyBuild);

  if (!androidVersionCode) {
    argv.androidVersionCode = AndroidBuildVersionGenerator.determineVersionCode(buildVersion);
  }
};
