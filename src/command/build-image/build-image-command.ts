import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import type { YargsInstance, Options } from '../../dependencies.ts';
import { System } from '../../model/system/system.ts';

export class BuildImageCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const baseOs = (options.baseOs as string) || 'ubuntu';
    const modules = (options.modules as string) || 'base';
    const unityVersion = options.unityVersion as string;
    const changeset = options.changeset as string | undefined;
    const tag = options.tag as string | undefined;
    const push = options.push as boolean;
    const hubImage = (options.hubImage as string) || 'unityci/hub';
    const baseImage = (options.baseImage as string) || 'unityci/base';

    if (!unityVersion) {
      log.error('--unity-version is required');
      return true;
    }

    // Resolve changeset if not provided
    let resolvedChangeset = changeset;
    if (!resolvedChangeset) {
      log.info(`Resolving changeset for Unity ${unityVersion}...`);
      try {
        const result = await System.run(
          `npx unity-changeset ${unityVersion}`,
          { silent: true },
        );
        resolvedChangeset = result.stdout.trim();
        if (!resolvedChangeset) throw new Error('empty changeset');
        log.info(`Changeset: ${resolvedChangeset}`);
      } catch {
        log.error(
          `Could not resolve changeset for ${unityVersion}. Use --changeset to provide it manually.`,
        );
        return true;
      }
    }

    // Determine image tag
    const moduleSlug = modules.replace(/,/g, '-');
    const imageTag =
      tag || `unityci/editor:${baseOs}-${unityVersion}-${moduleSlug}`;

    // Module arg: space-separated for Dockerfile's `for mod in $module` loop
    const moduleArg = modules.replace(/,/g, ' ');

    log.info(`Building image: ${imageTag}`);
    log.info(`  Base OS: ${baseOs}`);
    log.info(`  Modules: ${moduleArg}`);
    log.info(`  Unity: ${unityVersion}`);

    // Generate Dockerfile
    const dockerfile = generateDockerfile(baseOs);
    const dockerfilePath = `.game-ci-build-image.Dockerfile`;
    await Bun.write(dockerfilePath, dockerfile);

    try {
      // Build
      const buildCmd = [
        'docker build',
        `-f "${dockerfilePath}"`,
        `--build-arg hubImage="${hubImage}"`,
        `--build-arg baseImage="${baseImage}"`,
        `--build-arg version="${unityVersion}"`,
        `--build-arg changeSet="${resolvedChangeset}"`,
        `--build-arg module="${moduleArg}"`,
        `-t "${imageTag}"`,
        '.',
      ].join(' ');

      log.info(`Running: ${buildCmd}`);
      const buildResult = await System.run(buildCmd);
      if (buildResult.exitCode !== 0) {
        log.error(`Docker build failed with exit code ${buildResult.exitCode}`);
        return true;
      }

      log.info(`Successfully built: ${imageTag}`);

      // Push if requested
      if (push) {
        log.info(`Pushing ${imageTag}...`);
        const pushResult = await System.run(`docker push "${imageTag}"`);
        if (pushResult.exitCode !== 0) {
          log.error(`Docker push failed`);
          return true;
        }
        log.info(`Pushed: ${imageTag}`);
      }
    } finally {
      // Cleanup temp dockerfile
      try {
        const fs = await import('node:fs');
        fs.unlinkSync(dockerfilePath);
      } catch {}
    }

    return false;
  }

  public async configureOptions(yargs: YargsInstance): Promise<void> {
    yargs.positional('baseOs', {
      describe: 'Base operating system (ubuntu, windows)',
      type: 'string',
      default: 'ubuntu',
    });
    yargs.positional('modules', {
      describe: 'Comma-separated Unity modules to install',
      type: 'string',
      default: 'base',
    });
    yargs.option('unity-version', {
      describe: 'Unity editor version (e.g. 2022.3.20f1)',
      type: 'string',
      demandOption: true,
    });
    yargs.option('changeset', {
      describe: 'Unity changeset hash (auto-resolved if omitted)',
      type: 'string',
    });
    yargs.option('tag', {
      describe: 'Docker image tag (default: unityci/editor:<baseOs>-<version>-<modules>)',
      type: 'string',
    });
    yargs.option('push', {
      describe: 'Push image after building',
      type: 'boolean',
      default: false,
    });
    yargs.option('hub-image', {
      describe: 'Hub base image',
      type: 'string',
      default: 'unityci/hub',
    });
    yargs.option('base-image', {
      describe: 'Editor base image',
      type: 'string',
      default: 'unityci/base',
    });
  }
}

/**
 * Generate a Dockerfile for building Unity editor images with modules.
 * This codifies the logic from game-ci/docker/images/ubuntu/editor/Dockerfile
 * and game-ci/docker/images/windows/editor/Dockerfile.
 */
function generateDockerfile(baseOs: string): string {
  if (baseOs === 'windows') {
    return generateWindowsDockerfile();
  }
  return generateUbuntuDockerfile();
}

function generateUbuntuDockerfile(): string {
  return `ARG hubImage="unityci/hub"
ARG baseImage="unityci/base"

###########################
#         Builder         #
###########################

FROM $hubImage AS builder

# Install editor
ARG version
ARG changeSet
RUN unity-hub install --version "$version" --changeset "$changeSet" | tee /var/log/install-editor.log && grep 'Failed to install\\|Error while installing an editor\\|Completed with errors' /var/log/install-editor.log | exit $(wc -l)

# Install modules for that editor
ARG module="non-existent-module"
RUN for mod in $module; do \\
      if [ "$mod" = "base" ] ; then \\
        echo "running default modules for this baseOs"; \\
      else \\
        unity-hub install-modules --version "$version" --module "$mod" --childModules | tee /var/log/install-module-\${mod}.log && grep 'Missing module\\|Completed with errors' /var/log/install-module-\${mod}.log | exit $(wc -l); \\
      fi \\
    done \\
    && chmod -R 755 /opt/unity/editors/$version/Editor/Data/PlaybackEngines || true

###########################
#          Editor         #
###########################

FROM $baseImage

# Always put "Editor" and "modules.json" directly in $UNITY_PATH
ARG version
ARG module
COPY --from=builder /opt/unity/editors/$version/ "$UNITY_PATH/"

# Add a file containing the version for this build
RUN echo $version > "$UNITY_PATH/version"

###########################
#  Alias to unity-editor  #
###########################

RUN /bin/echo -e '#!/bin/bash\\n\\
\\n\\
if [ -d /usr/bin/unity-editor.d ] ; then\\n\\
  for i in /usr/bin/unity-editor.d/*.sh; do\\n\\
    if [ -r $i ]; then\\n\\
      . $i\\n\\
    fi\\n\\
  done\\n\\
fi\\n\\
\\n\\
xvfb-run -ae /dev/stdout "$UNITY_PATH/Editor/Unity" -batchmode "$@"' > /usr/bin/unity-editor \\
  && chmod 755 /usr/bin/unity-editor \\
  && mkdir -p /usr/bin/unity-editor.d

###########################
#    Module-specific      #
###########################

# WebGL: ffmpeg + build-essential + clang
RUN echo "$module" | grep -q 'webgl' \\
  && apt-get update && apt-get -q install -y --no-install-recommends ffmpeg build-essential clang && apt-get clean && rm -rf /var/lib/apt/lists/* \\
  || true

# IL2CPP: build-essential + clang
RUN echo "$module" | grep -q 'linux-il2cpp' \\
  && apt-get update && apt-get -q install -y --no-install-recommends build-essential clang && apt-get clean && rm -rf /var/lib/apt/lists/* \\
  || true
`;
}

function generateWindowsDockerfile(): string {
  return `# escape=\`
ARG hubImage="unityci/hub"
ARG baseImage="unityci/base"

###########################
#         Builder         #
###########################

FROM $hubImage AS builder

ARG version
ARG changeSet
ARG module

SHELL ["cmd", "/S", "/C"]

RUN unity-hub install --version %version% --changeset %changeSet% || exit 0

RUN if not "%module%"=="base" ( \\
      for %%m in (%module%) do ( \\
        unity-hub install-modules --version %version% --module %%m --childModules || exit 0 \\
      ) \\
    )

###########################
#          Editor         #
###########################

FROM $baseImage

ARG version
COPY --from=builder "C:\\\\Program Files\\\\Unity\\\\Hub\\\\Editor\\\\%version%" "C:\\\\Program Files\\\\Unity\\\\Hub\\\\Editor\\\\%version%"

RUN echo %version% > "C:\\\\Program Files\\\\Unity\\\\version"
`;
}
