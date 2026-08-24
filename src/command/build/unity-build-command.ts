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
import { scanForWindowsOnlyEditorPlugins } from '../../logic/unity/native-plugin-compatibility.ts';

export class UnityBuildCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const { hostPlatform, hostOS, engine } = options;

    PlatformValidation.checkCompatibility(options);
    CacheValidation.verify(options);

    // The Windows-only-Editor-plugin visibility gate (see
    // native-plugin-compatibility.ts) is specific to a Linux-hosted Editor -
    // it's exactly the container Docker.run's getLinuxCommand path spins up
    // (unityci/editor images on hostOS 'linux'), regardless of what
    // targetPlatform is being cross-compiled for. Skip it for the Windows
    // container path (getWindowsCommand) and for macOS, which never goes
    // through Docker.run at all here (see MacBuilder branch below).
    if (engine === 'unity' && hostOS === 'linux' && !options.skipNativePluginCheck) {
      UnityBuildCommand.warnAboutWindowsOnlyEditorPlugins(options);
    }

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

  /**
   * Warning-only preflight (see native-plugin-compatibility.ts) - never
   * throws, since a false positive here (e.g. a plugin that's actually
   * guarded behind a #if UNITY_STANDALONE_WIN and never referenced in a
   * Linux-container build) must never fail-close a build that would
   * otherwise have succeeded.
   */
  private static warnAboutWindowsOnlyEditorPlugins(options: Options): void {
    try {
      const projectDir: string =
        (options as any).projectPath || (options as any).workspace || process.cwd();
      const flagged = scanForWindowsOnlyEditorPlugins(projectDir);
      if (flagged.length === 0) return;

      const list = flagged.map((plugin) => `  - ${plugin.path}`).join('\n');
      log.warning(String.dedent`
        [native-plugin-compatibility] ${flagged.length} native plugin(s) are Editor-visible on Windows hosts only,
        but this build is running inside a Linux container - they may be invisible to the Editor here and could
        cause confusing compile errors if referenced unconditionally:
        ${list}
        If this looks wrong, check the plugin's Inspector > Platform Settings > Editor > OS setting. If the plugin
        is meant to be Windows-only and is only ever referenced behind a preprocessor guard (e.g. #if
        UNITY_STANDALONE_WIN), this warning can be safely ignored.
      `);
    } catch (error: any) {
      // Best-effort scan - never let a scan failure interrupt the build.
      if (log.isVerbose) log.debug(`[native-plugin-compatibility] scan failed: ${error?.message}`);
    }
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
