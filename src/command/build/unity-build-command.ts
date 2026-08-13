import { CommandInterface } from '../command-interface.ts';
import { CacheValidation, Docker, RunnerImageTag, Output } from '../../model/index.ts';
import { PlatformSetup } from '../../logic/unity/platform-setup/index.ts';
import { MacBuilder } from '../../model/mac-builder.ts';
import { UnityLogs } from '../../model/unity-logs.ts';
import { path } from '../../dependencies.ts';
import { CommandBase } from '../command-base.ts';
import { UnityOptions } from '../../command-options/unity-options.ts';
import type { YargsInstance, Options } from '../../dependencies.ts';
import { VersioningOptions } from '../../command-options/versioning-options.ts';
import { BuildOptions } from '../../command-options/build-options.ts';
import { AndroidOptions } from '../../command-options/android-options.ts';
import { UnityLogsOptions } from '../../command-options/unity-logs-options.ts';
import { PlatformValidation } from '../../logic/unity/platform-validation/platform-validation.ts';
import { ProjectOptions } from '../../command-options/project-options.ts';

export class UnityBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const { hostPlatform } = options;

    PlatformValidation.checkCompatibility(options);
    CacheValidation.verify(options);

    const image = new RunnerImageTag(options);
    if (log.isVerbose) log.debug('Using image:', image);

    await PlatformSetup.setup(options);

    let stopTail: (() => void) | undefined;
    if (options.streamUnityLogs) {
      const projectDir: string =
        (options as any).projectPath || (options as any).workspace || process.cwd();
      const explicit = String(options.streamUnityLogPaths || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const defaults = [path.join(projectDir, 'Builds', 'Logs', 'Editor.log')];
      stopTail = UnityLogs.streamFiles(explicit.length > 0 ? explicit : defaults);
      log.info('[UnityLogs] Live log streaming started');
    }

    let buildError: unknown;
    let buildSucceeded = true;
    try {
      await log.group('Unity build', async () => {
        if (hostPlatform === 'darwin') {
          await MacBuilder.run(options);
        } else {
          await Docker.run(image.toString(), options);
        }
      });
    } catch (error) {
      buildError = error;
      buildSucceeded = false;
    } finally {
      if (stopTail) {
        try {
          stopTail();
        } catch {
          // ignore
        }
      }
    }

    if (
      options.collectUnityLogs &&
      (!buildSucceeded || options.collectUnityLogsOnSuccess !== false)
    ) {
      try {
        const projectDir: string =
          (options as any).projectPath || (options as any).workspace || process.cwd();
        const workspace: string = (options as any).workspace || projectDir;
        UnityLogs.collect({
          workspace,
          projectPath: projectDir,
          outputDir: options.unityLogsOutputDir || undefined,
          categories: UnityLogs.parseCategories(options.unityLogCategories),
          includeSensitive: !!options.unityLogsIncludeSensitive,
        });
      } catch (collectError: any) {
        log.warning(`[UnityLogs] collection failed: ${collectError.message}`);
      }
    }

    if (buildError) throw buildError;

    await Output.setBuildVersion(options.buildVersion);
    await Output.setAndroidVersionCode(options.androidVersionCode);

    return true;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    await ProjectOptions.configure(yargs);
    await UnityOptions.configure(yargs);
    await VersioningOptions.configure(yargs);
    await BuildOptions.configure(yargs);
    await AndroidOptions.configure(yargs);
    await UnityLogsOptions.configure(yargs);
  }
}
