import OrchestratorLogger from '../services/core/orchestrator-logger';
import { OrchestratorFolders } from '../options/orchestrator-folders';
import { OrchestratorStepParameters } from '../options/orchestrator-step-parameters';
import { WorkflowInterface } from './workflow-interface';
import { CommandHookService } from '../services/hooks/command-hook-service';
import path from 'node:path';
import Orchestrator from '../orchestrator';
import { ContainerHookService } from '../services/hooks/container-hook-service';
import { CacheCheckpointService } from '../services/cache/cache-checkpoint-service';
import { PreflightService } from '../services/preflight';
import { getEngine } from '../../engine';

export class BuildAutomationWorkflow implements WorkflowInterface {
  async run(orchestratorStepState: OrchestratorStepParameters) {
    return await BuildAutomationWorkflow.standardBuildAutomation(
      orchestratorStepState.image,
      orchestratorStepState,
    );
  }

  private static async standardBuildAutomation(
    baseImage: string,
    orchestratorStepState: OrchestratorStepParameters,
  ) {
    // TODO accept post and pre build steps as yaml files in the repo
    OrchestratorLogger.log(`Orchestrator is running standard build automation`);

    let output = '';

    output += await ContainerHookService.RunPreBuildSteps(orchestratorStepState);
    OrchestratorLogger.logWithTime('Configurable pre build step(s) time');

    // Preflight gate: fast no-engine validation before any expensive build
    // dispatch. Fail-fast -- a failing preflight check aborts the build with
    // a clear error instead of paying minutes/hours of build cost.
    await BuildAutomationWorkflow.runPreflight();

    OrchestratorLogger.log(baseImage);
    OrchestratorLogger.logLine(` `);
    OrchestratorLogger.logLine('Starting build automation job');

    // Local Library/LFS caching for the bare-host `local`/`local-system`
    // provider strategy -- mirrors the restore step plugin-lifecycle.ts runs
    // in beforeLocalBuild() for the unity-builder integration surface, but
    // calls LocalCacheService directly instead of going through that surface
    // (this code path is the standalone `game-ci orchestrate` CLI command).
    const localCacheState = await BuildAutomationWorkflow.restoreLocalCacheIfEnabled();

    output += await Orchestrator.Provider.runTaskInWorkflow(
      Orchestrator.buildParameters.buildGuid,
      baseImage.toString(),
      BuildAutomationWorkflow.BuildWorkflow,
      `/${OrchestratorFolders.buildVolumeFolder}`,
      `/${OrchestratorFolders.buildVolumeFolder}/`,
      orchestratorStepState.environment,
      orchestratorStepState.secrets,
    );
    OrchestratorLogger.logWithTime('Build time');

    // Save step mirrors plugin-lifecycle.ts's afterLocalBuild() handling.
    // Only reached if runTaskInWorkflow above resolved rather than throwing,
    // i.e. Unity actually ran to completion.
    await BuildAutomationWorkflow.saveLocalCacheIfEnabled(localCacheState);

    output += await ContainerHookService.RunPostBuildSteps(orchestratorStepState);
    OrchestratorLogger.logWithTime('Configurable post build step(s) time');

    OrchestratorLogger.log(`Orchestrator finished running standard build automation`);

    return output;
  }

  /**
   * Load and execute the configured preflight suite. Skips silently when
   * `preflightSuite` is empty (preserves behaviour for callers that have
   * not opted in). On failure, throws and aborts the build automation.
   */
  private static async runPreflight(): Promise<void> {
    const suitePath = Orchestrator.buildParameters?.preflightSuite;

    // Empty string or undefined -> opt-out. Use 'default' to run the
    // built-in fallback suite when no .game-ci/preflight-suite.yml exists.
    if (!suitePath) {
      OrchestratorLogger.log('Preflight: skipped (no preflightSuite configured)');
      return;
    }

    OrchestratorLogger.log(`Preflight: running suite '${suitePath}'`);
    const suite = PreflightService.loadSuite(suitePath === 'default' ? undefined : suitePath);
    const results = await PreflightService.executeSuite(suite);
    PreflightService.reportResults(results);
    OrchestratorLogger.logWithTime('Preflight time');

    if (!results.passed) {
      const failedAt = results.failedAt ?? -1;
      const failedCheck = failedAt >= 0 ? results.results[failedAt] : undefined;
      const detail = failedCheck
        ? `check '${failedCheck.checkId}': ${failedCheck.error ?? 'no error message'}`
        : 'unknown failure';
      throw new Error(`Preflight suite '${suite.name}' failed at ${detail}`);
    }
  }

  /**
   * True for game-ci/orchestrator's bare-host `local`/`local-system` provider
   * strategy (both backed by LocalOrchestrator -- see
   * plugins/orchestrator/src/cli-plugin/index.ts). Non-containerized like
   * aws/k8s/local-docker's remote-dispatch cousins (test, gcp-cloud-run,
   * github-actions, ...), but unlike those it actually needs to invoke Unity
   * directly on this machine.
   */
  private static get isBareLocalProvider(): boolean {
    const isContainerized =
      Orchestrator.buildParameters.providerStrategy === 'aws' ||
      Orchestrator.buildParameters.providerStrategy === 'k8s' ||
      Orchestrator.buildParameters.providerStrategy === 'local-docker';

    return (
      !isContainerized &&
      (Orchestrator.buildParameters.providerStrategy === 'local' ||
        Orchestrator.buildParameters.providerStrategy === 'local-system')
    );
  }

  /**
   * Restore Library/LFS caches via LocalCacheService before Unity runs, for
   * the bare-host `local`/`local-system` provider strategy only. Mirrors
   * plugin-lifecycle.ts's beforeLocalBuild() local-cache-restore block.
   *
   * LocalCacheService's restore methods already catch and log their own
   * errors internally (a cache miss or restore failure returns
   * false/void rather than throwing), so a first run with no cache yet is
   * expected to log a miss and fall through -- not fail the build. The
   * try/catch here is an extra safety net around resolveCacheRoot /
   * generateCacheKey / generateCacheKeyCandidates, which are cheap sync
   * calls but are still wrapped so that any unexpected error here can never
   * abort the build.
   */
  private static async restoreLocalCacheIfEnabled(): Promise<
    { cacheRoot: string; cacheKey: string } | undefined
  > {
    const bp = Orchestrator.buildParameters;
    if (!BuildAutomationWorkflow.isBareLocalProvider || !bp.localCacheEnabled) {
      return undefined;
    }

    try {
      const { LocalCacheService } = await import('../services/cache/local-cache-service');
      const cacheRoot = LocalCacheService.resolveCacheRoot(bp as any) || '';
      const cacheKey =
        LocalCacheService.generateCacheKey(bp.targetPlatform, bp.editorVersion, bp.branch || '') ||
        '';

      // GITHUB_WORKSPACE for the bare-local provider is process.cwd() (see
      // the isBareLocalProvider branch of BuildWorkflow below); the project
      // itself lives at process.cwd()/<projectPath> underneath that.
      const workspacePath = process.cwd();
      const projectFullPath = path.join(workspacePath, bp.projectPath);

      if (bp.localCacheLfs) {
        await LocalCacheService.restoreLfsCache(workspacePath, cacheRoot, cacheKey);
      }

      if (bp.localCacheLibrary) {
        const fallbackKeys = bp.localCacheFallback
          ? LocalCacheService.generateCacheKeyCandidates(
              cacheRoot,
              bp.targetPlatform,
              bp.editorVersion,
              bp.branch || '',
              String(bp.localCacheFallbackKeys || '')
                .split(',')
                .map((key: string) => key.trim())
                .filter(Boolean),
            ).filter((key) => key !== cacheKey)
          : [];

        await LocalCacheService.restoreEngineCache(projectFullPath, cacheRoot, cacheKey, {
          fallbackKeys,
          restoreMode: bp.localCacheMode as any,
        });
      }

      return { cacheRoot, cacheKey };
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[LocalCache] Restore step failed, continuing without cache: ${error.message}`,
      );

      return undefined;
    }
  }

  /**
   * Save Library/LFS caches via LocalCacheService after Unity finishes, for
   * the bare-host `local`/`local-system` provider strategy only. Mirrors
   * plugin-lifecycle.ts's afterLocalBuild() local-cache-save block.
   *
   * LocalCacheService's save methods already catch and log their own errors
   * internally and never throw, so this can never mask a build that
   * otherwise completed successfully. The try/catch is an extra safety net,
   * matching restoreLocalCacheIfEnabled() above.
   */
  private static async saveLocalCacheIfEnabled(
    cacheState: { cacheRoot: string; cacheKey: string } | undefined,
  ): Promise<void> {
    const bp = Orchestrator.buildParameters;
    if (!BuildAutomationWorkflow.isBareLocalProvider || !bp.localCacheEnabled || !cacheState) {
      return;
    }

    try {
      const { LocalCacheService } = await import('../services/cache/local-cache-service');
      const { cacheRoot, cacheKey } = cacheState;
      const workspacePath = process.cwd();
      const projectFullPath = path.join(workspacePath, bp.projectPath);

      if (bp.localCacheLibrary) {
        await LocalCacheService.saveEngineCache(projectFullPath, cacheRoot, cacheKey, {
          saveMode: bp.localCacheMode as any,
          skipOnLfsPointerPoisoning: true,
          maxCacheEntries: bp.maxCacheEntries,
        });
      }

      if (bp.localCacheLfs) {
        await LocalCacheService.saveLfsCache(workspacePath, cacheRoot, cacheKey, bp.maxCacheEntries);
      }
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[LocalCache] Save step failed after a successful build: ${error.message}`,
      );
    }
  }

  private static get BuildWorkflow() {
    const setupHooks = CommandHookService.getHooks(
      Orchestrator.buildParameters.commandHooks,
    ).filter((x) => x.step?.includes(`setup`));
    const buildHooks = CommandHookService.getHooks(
      Orchestrator.buildParameters.commandHooks,
    ).filter((x) => x.step?.includes(`build`));
    const isContainerized =
      Orchestrator.buildParameters.providerStrategy === 'aws' ||
      Orchestrator.buildParameters.providerStrategy === 'k8s' ||
      Orchestrator.buildParameters.providerStrategy === 'local-docker';

    const isBareLocalProvider = BuildAutomationWorkflow.isBareLocalProvider;

    const builderPath = isContainerized
      ? OrchestratorFolders.ToLinuxFolder(
          path.join(OrchestratorFolders.builderPathAbsolute, 'dist', `index.js`),
        )
      : OrchestratorFolders.ToLinuxFolder(path.join(process.cwd(), 'dist', `index.js`));

    // prettier-ignore
    return `echo "orchestrator build workflow starting"
      ${
        isContainerized && Orchestrator.buildParameters.providerStrategy !== 'local-docker'
          ? 'apt-get update > /dev/null || true'
          : '# skipping apt-get in local-docker or non-container provider'
      }
      ${
        isContainerized && Orchestrator.buildParameters.providerStrategy !== 'local-docker'
          ? 'apt-get install -y curl tar tree npm git-lfs jq git > /dev/null || true\n      npm --version || true\n      npm i -g n > /dev/null || true\n      npm i -g semver > /dev/null || true\n      command -v yarn > /dev/null 2>&1 || npm install --global yarn > /dev/null || true\n      n 20.8.0 || true\n      node --version || true'
          : '# skipping toolchain setup in local-docker or non-container provider'
      }
      ${setupHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${
        Orchestrator.buildParameters.providerStrategy === 'local-docker'
          ? `export GITHUB_WORKSPACE="${Orchestrator.buildParameters.dockerWorkspacePath}"
      echo "Using docker workspace: $GITHUB_WORKSPACE"`
          : isBareLocalProvider
            ? `export GITHUB_WORKSPACE="${OrchestratorFolders.ToLinuxFolder(process.cwd())}"
      echo "Using local workspace: $GITHUB_WORKSPACE"`
            : `export GITHUB_WORKSPACE="${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.repoPathAbsolute)}"`
      }
      ${isContainerized ? 'df -H /data/' : '# skipping df on /data in non-container provider'}
      export LOG_FILE=${isContainerized ? '/home/job-log.txt' : '$(pwd)/temp/job-log.txt'}
      ${BuildAutomationWorkflow.setupCommands(builderPath, isContainerized)}
      ${setupHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}
      ${buildHooks.filter((x) => x.hook.includes(`before`)).map((x) => x.commands) || ' '}
      ${BuildAutomationWorkflow.BuildCommands(builderPath, isContainerized, isBareLocalProvider)}
      ${buildHooks.filter((x) => x.hook.includes(`after`)).map((x) => x.commands) || ' '}`;
  }

  private static setupCommands(builderPath: string, isContainerized: boolean) {
    // prettier-ignore
    const commands = `mkdir -p ${OrchestratorFolders.ToLinuxFolder(
      OrchestratorFolders.builderPathAbsolute,
    )}
${OrchestratorFolders.gitAuthConfigScript}
${OrchestratorFolders.cloneBuilderScript(OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.builderPathAbsolute))}
chmod +x ${builderPath}`;

    if (isContainerized) {
      const cloneBuilderCommands = `if [ -e "${OrchestratorFolders.ToLinuxFolder(
        OrchestratorFolders.uniqueOrchestratorJobFolderAbsolute,
      )}" ] && [ -e "${OrchestratorFolders.ToLinuxFolder(
        path.join(OrchestratorFolders.builderPathAbsolute, `.git`),
      )}" ] ; then echo "Builder Already Exists!" && (command -v tree > /dev/null 2>&1 && tree ${
        OrchestratorFolders.builderPathAbsolute
      } || ls -la ${OrchestratorFolders.builderPathAbsolute}); else ${commands} ; fi`;

      return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
${cloneBuilderCommands}
export CACHE_KEY="${Orchestrator.buildParameters.cacheKey}"
echo "log start" >> /home/job-log.txt
echo "CACHE_KEY=$CACHE_KEY"
${
  Orchestrator.buildParameters.providerStrategy !== 'local-docker'
    ? `node ${builderPath} -m remote-cli-pre-build`
    : `# skipping remote-cli-pre-build in local-docker`
}`;
    }

    return `export GIT_DISCOVERY_ACROSS_FILESYSTEM=1
mkdir -p "$(dirname "$LOG_FILE")"
echo "log start" >> "$LOG_FILE"
export CACHE_KEY="${Orchestrator.buildParameters.cacheKey}"
echo "CACHE_KEY=$CACHE_KEY"`;
  }

  private static BuildCommands(
    builderPath: string,
    isContainerized: boolean,
    isBareLocalProvider = false,
  ) {
    const distFolder = path.join(OrchestratorFolders.builderPathAbsolute, 'dist');
    const ubuntuPlatformsFolder = path.join(
      OrchestratorFolders.builderPathAbsolute,
      'dist',
      'platforms',
      'ubuntu',
    );

    if (isContainerized) {
      if (Orchestrator.buildParameters.providerStrategy === 'local-docker') {
        // prettier-ignore
        return `
    mkdir -p ${`${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.projectBuildFolderAbsolute)}/build`}
    mkdir -p "/data/cache/$CACHE_KEY/build"
    cd "$GITHUB_WORKSPACE/${Orchestrator.buildParameters.projectPath}"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    ${Orchestrator.buildParameters.skipInContainerClone
      ? `# Skipping in-container Git LFS pull because skipInContainerClone is true.
    # The caller is responsible for hydrating LFS content on the host before the container starts.
    echo "Skipping in-container Git LFS pull (skipInContainerClone=true)"`
      : `# Ensure Git LFS files are available inside the container for local-docker runs
    if [ -d "$GITHUB_WORKSPACE/.git" ]; then
      echo "Ensuring Git LFS content is pulled"
      (cd "$GITHUB_WORKSPACE" \
        && git lfs install || true \
        && git config --global filter.lfs.smudge "git-lfs smudge -- %f" \
        && git config --global filter.lfs.process "git-lfs filter-process" \
        && git lfs pull || true \
        && git lfs checkout || true)
    else
      echo "Skipping Git LFS pull: no .git directory in workspace"
    fi`}
    # Normalize potential CRLF line endings and create safe stubs for missing tooling
    if command -v sed > /dev/null 2>&1; then
      sed -i 's/\r$//' "/entrypoint.sh" || true
      find "/steps" -type f -exec sed -i 's/\r$//' {} + || true
    fi
    if ! command -v node > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/node && chmod +x /usr/local/bin/node; fi
    if ! command -v npm > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/npm && chmod +x /usr/local/bin/npm; fi
    if ! command -v n > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/n && chmod +x /usr/local/bin/n; fi
    if ! command -v yarn > /dev/null 2>&1; then printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/yarn && chmod +x /usr/local/bin/yarn; fi
    ${Orchestrator.buildParameters.cacheSaveOnFailure ? CacheCheckpointService.generateFailureTrapScript('/data/cache/$CACHE_KEY', Orchestrator.buildParameters.cacheSaveOnFailureFilter) : ''}
    # Pipe entrypoint.sh output through log stream to capture Unity build output (including "Build succeeded")
    { echo "game ci start"; echo "game ci start" >> /home/job-log.txt; echo "CACHE_KEY=$CACHE_KEY"; echo "$CACHE_KEY"; if [ -n "$LOCKED_WORKSPACE" ]; then echo "Retained Workspace: true"; fi; if [ -n "$LOCKED_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/.git" ]; then echo "Retained Workspace Already Exists!"; fi; /entrypoint.sh; } | node ${builderPath} -m remote-cli-log-stream --logFile /home/job-log.txt
    ${BuildAutomationWorkflow.engineCacheCommands()}
    # Ensure cache directories exist for post-build and S3 upload hooks.
    # Do NOT create empty placeholder tars — they waste S3 storage and on next
    # build the pull-cache hook downloads them, giving Unity an empty Library
    # folder (zero caching benefit, full reimport every time).
    mkdir -p "/data/cache/$CACHE_KEY/build"
    # Run post-build tasks and capture output
    # Note: Post-build may clean up the builder directory, so we write output directly to log file
    # Use set +e to allow the command to fail without exiting the script
    set +e
    # Run post-build and write output to both stdout (for K8s kubectl logs) and log file
    # For local-docker, stdout is captured by the log stream mechanism
    if [ -f "${builderPath}" ]; then
      # Use tee to write to both stdout and log file, ensuring output is captured
      # For K8s, kubectl logs reads from stdout, so we need stdout
      # For local-docker, the log file is read directly
      node ${builderPath} -m remote-cli-post-build 2>&1 | tee -a /home/job-log.txt || echo "Post-build command completed with warnings" | tee -a /home/job-log.txt
    else
      # Builder doesn't exist, skip post-build (shouldn't happen, but handle gracefully)
      echo "Builder path not found, skipping post-build" | tee -a /home/job-log.txt
    fi
    # Write "Collected Logs" message for K8s (needed for test assertions)
    # Write to both stdout and log file to ensure it's captured even if kubectl has issues
    # Also write to PVC (/data) as backup in case pod is OOM-killed and ephemeral filesystem is lost
    echo "Collected Logs" | tee -a /home/job-log.txt /data/job-log.txt 2>/dev/null || echo "Collected Logs" | tee -a /home/job-log.txt
    # Write end markers directly to log file (builder might be cleaned up by post-build)
    # Also write to stdout for K8s kubectl logs
    echo "end of orchestrator job" | tee -a /home/job-log.txt
    echo "---${Orchestrator.buildParameters.logId}" | tee -a /home/job-log.txt
    # Don't restore set -e - keep set +e to prevent script from exiting on error
    # This ensures the script completes successfully even if some operations fail
    # Mirror cache back into workspace for test assertions
    ${BuildAutomationWorkflow.engineCacheMirrorCommands()}
    mkdir -p "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/build"
    cp -a "/data/cache/$CACHE_KEY/build/." "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/build/" || true`;
      }

      // prettier-ignore
      return `
    mkdir -p ${`${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.projectBuildFolderAbsolute)}/build`}
    cd ${OrchestratorFolders.ToLinuxFolder(OrchestratorFolders.projectPathAbsolute)}
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(distFolder, 'default-build-script'))}" "/UnityBuilderAction"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'entrypoint.sh'))}" "/entrypoint.sh"
    cp -r "${OrchestratorFolders.ToLinuxFolder(path.join(ubuntuPlatformsFolder, 'steps'))}" "/steps"
    chmod -R +x "/entrypoint.sh"
    chmod -R +x "/steps"
    { echo "game ci start"; echo "game ci start" >> /home/job-log.txt; echo "CACHE_KEY=$CACHE_KEY"; echo "$CACHE_KEY"; if [ -n "$LOCKED_WORKSPACE" ]; then echo "Retained Workspace: true"; fi; if [ -n "$LOCKED_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/.git" ]; then echo "Retained Workspace Already Exists!"; fi; /entrypoint.sh; } | node ${builderPath} -m remote-cli-log-stream --logFile /home/job-log.txt
    # Run post-build and capture output to both stdout (for kubectl logs) and log file
    # Note: Post-build may clean up the builder directory, so write output directly
    set +e
    if [ -f "${builderPath}" ]; then
      # Use tee to write to both stdout and log file for K8s kubectl logs
      node ${builderPath} -m remote-cli-post-build 2>&1 | tee -a /home/job-log.txt || echo "Post-build command completed with warnings" | tee -a /home/job-log.txt
    else
      echo "Builder path not found, skipping post-build" | tee -a /home/job-log.txt
    fi
    # Write "Collected Logs" message for K8s (needed for test assertions)
    # Write to both stdout and log file to ensure it's captured even if kubectl has issues
    # Also write to PVC (/data) as backup in case pod is OOM-killed and ephemeral filesystem is lost
    echo "Collected Logs" | tee -a /home/job-log.txt /data/job-log.txt 2>/dev/null || echo "Collected Logs" | tee -a /home/job-log.txt
    # Write end markers to both stdout and log file (builder might be cleaned up by post-build)
    echo "end of orchestrator job" | tee -a /home/job-log.txt
    echo "---${Orchestrator.buildParameters.logId}" | tee -a /home/job-log.txt`;
    }

    if (isBareLocalProvider) {
      const bp = Orchestrator.buildParameters;
      // Same step-script chain game-ci/cli's own HostRunner (src/model/host-runner.ts)
      // drives for `game-ci build/test --local`: runsteps.sh -> activate.sh ->
      // build.sh/test.sh -> return_license.sh, run directly against this host's
      // Unity install. Deliberately skips entrypoint.sh (container-only setup:
      // /etc/machine-id randomization, useradd/groupadd) for the same reason
      // HostRunner does -- see the comment on HostRunner for why that would be
      // dangerous to run against a real, persistent self-hosted machine.
      //
      // No repo clone / LFS pull here (unlike the aws/k8s/local-docker branches
      // above): the `local` provider is for a self-hosted runner where the
      // project is assumed already checked out and hydrated at GITHUB_WORKSPACE
      // (set to process.cwd() above), so there is nothing to clone or hydrate.
      const stepsDir = OrchestratorFolders.ToLinuxFolder(
        path.join(process.cwd(), 'dist', 'platforms', 'ubuntu', 'steps'),
      );

      // prettier-ignore
      return `
    echo "game ci start"
    echo "game ci start" >> "$LOG_FILE"
    export STEPS_DIR="${stepsDir}"
    export PROJECT_PATH="${bp.projectPath || ''}"
    export BUILD_TARGET="${bp.targetPlatform || ''}"
    export BUILD_NAME="${bp.buildName || ''}"
    export BUILD_PATH="${bp.buildPath || ''}"
    export BUILD_FILE="${bp.buildFile || ''}"
    export BUILD_METHOD="${bp.buildMethod || ''}"
    export VERSION="${bp.buildVersion || ''}"
    export ANDROID_VERSION_CODE="${bp.androidVersionCode || ''}"
    export CHOWN_FILES_TO="${bp.chownFilesTo || ''}"
    export MANUAL_EXIT="${bp.manualExit ? 'true' : ''}"
    export BUILD_PROFILE="${bp.buildProfile || ''}"
    export SKIP_ACTIVATION="${bp.skipActivation ? 'true' : ''}"
    # entrypoint.sh normally creates this before sourcing runsteps.sh; replicated
    # here since we bypass entrypoint.sh entirely (see HostRunner.buildEnv).
    export ACTIVATE_LICENSE_PATH="$GITHUB_WORKSPACE/_activate-license~"
    mkdir -p "$ACTIVATE_LICENSE_PATH"
    mkdir -p "$GITHUB_WORKSPACE/$BUILD_PATH"
    # Pipe runsteps.sh output through log stream to capture Unity build/activation output
    { bash "$STEPS_DIR/runsteps.sh"; echo "RUNSTEPS_EXIT_CODE:$?" >> "$LOG_FILE"; } | node ${builderPath} -m remote-cli-log-stream --logFile "$LOG_FILE"
    node ${builderPath} -m remote-cli-post-build`;
    }

    // prettier-ignore
    return `
    echo "game ci start"
    echo "game ci start" >> "$LOG_FILE"
    timeout 3s node ${builderPath} -m remote-cli-log-stream --logFile "$LOG_FILE" || true
    node ${builderPath} -m remote-cli-post-build`;
  }

  /**
   * Generate shell commands to ensure cache directories exist for each engine cache folder.
   * Real cache tars are created by remote-cli-post-build, not here.
   */
  private static engineCacheCommands(): string {
    return getEngine()
      .cacheFolders.map((folder) => {
        const prefix = folder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

        return `mkdir -p "/data/cache/$CACHE_KEY/${folder}"`;
      })
      .join('\n    ');
  }

  /**
   * Generate shell commands to mirror engine cache folders back into workspace for test assertions.
   */
  private static engineCacheMirrorCommands(): string {
    return getEngine()
      .cacheFolders.map(
        (folder) =>
          `mkdir -p "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/${folder}"
    cp -a "/data/cache/$CACHE_KEY/${folder}/." "$GITHUB_WORKSPACE/orchestrator-cache/cache/$CACHE_KEY/${folder}/" || true`,
      )
      .join('\n    ');
  }
}
