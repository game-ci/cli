import { CommandInterface } from '../command-interface.ts';
import { CommandBase } from '../command-base.ts';
import type { YargsInstance, Options } from '../../dependencies.ts';
import { System } from '../../model/system/system.ts';
import { RecipeFileError, RecipeFileReader } from '../../model/build-image/recipe-file.ts';

export class BuildImageCommand extends CommandBase implements CommandInterface {
  public async execute(options: Options): Promise<boolean> {
    const recipePath = options.recipe as string | undefined;

    // A recipe file is the "commit it to the repo, code-review it, diff it"
    // source of truth (see docs/proposals/recipe-file-format.md) — when one
    // is given, its fields take priority over the CLI flags/positionals
    // (which otherwise carry their own hardcoded defaults, e.g. baseOs
    // defaulting to "ubuntu" whether or not the user typed it). --push is
    // a per-invocation action, not a recipe property, so it always comes
    // from the flag.
    let recipe: ReturnType<typeof RecipeFileReader.read> | undefined;
    if (recipePath) {
      try {
        recipe = RecipeFileReader.read(recipePath);
      } catch (error: any) {
        if (error instanceof RecipeFileError) {
          log.error(error.message);
          return false;
        }
        throw error;
      }
    }

    const baseOs = recipe?.baseOs || (options.baseOs as string) || 'ubuntu';
    const modules = recipe?.modules ? recipe.modules.join(',') : (options.modules as string) || 'base';
    const unityVersion = recipe?.unityVersion || (options.unityVersion as string);
    const changeset = recipe?.changeset || (options.changeset as string | undefined);
    const tag = recipe?.tag || (options.tag as string | undefined);
    const push = options.push as boolean;
    const defaultHubImage = baseOs === 'windows' ? 'unityci/hub:windows-latest' : 'unityci/hub';
    const defaultBaseImage = baseOs === 'windows' ? 'unityci/base:windows-latest' : 'unityci/base';
    const hubImage = recipe?.hubImage || (options.hubImage as string) || defaultHubImage;
    const baseImage = recipe?.baseImage || (options.baseImage as string) || defaultBaseImage;

    if (!unityVersion) {
      log.error(recipe ? `Recipe file "${recipePath}" is missing required field "unityVersion".` : '--unity-version is required');
      return false;
    }

    // Resolve changeset if not provided
    let resolvedChangeset = changeset;
    if (!resolvedChangeset) {
      log.info(`Resolving changeset for Unity ${unityVersion}...`);
      try {
        const result = await System.run(`npx unity-changeset ${unityVersion}`, undefined, {
          silent: true,
        });
        resolvedChangeset = result.output.trim();
        if (!resolvedChangeset) throw new Error('empty changeset');
        log.info(`Changeset: ${resolvedChangeset}`);
      } catch {
        log.error(
          `Could not resolve changeset for ${unityVersion}. Use --changeset to provide it manually.`,
        );
        return false;
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
      let buildFailed = false;
      await log.group(`docker build (${imageTag})`, async () => {
        try {
          await System.run(buildCmd);
        } catch (error: any) {
          log.error(`Docker build failed: ${error.message}`);
          buildFailed = true;
        }
      });
      if (buildFailed) return false;

      log.info(`Successfully built: ${imageTag}`);

      // Push if requested
      if (push) {
        log.info(`Pushing ${imageTag}...`);
        let pushFailed = false;
        await log.group(`docker push (${imageTag})`, async () => {
          try {
            await System.run(`docker push "${imageTag}"`);
          } catch (error: any) {
            log.error(`Docker push failed: ${error.message}`);
            pushFailed = true;
          }
        });
        if (pushFailed) return false;
        log.info(`Pushed: ${imageTag}`);
      }
    } finally {
      // Cleanup temp dockerfile
      try {
        const fs = await import('node:fs');
        fs.unlinkSync(dockerfilePath);
      } catch {}
    }

    return true;
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
      describe: 'Unity editor version (e.g. 2022.3.20f1). Required unless provided via --recipe.',
      type: 'string',
    });
    yargs.option('recipe', {
      describe:
        'Path to a declarative recipe YAML file (see docs/proposals/recipe-file-format.md). ' +
        'Fields in the recipe take priority over the corresponding CLI flags.',
      type: 'string',
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
    });
    yargs.option('base-image', {
      describe: 'Editor base image',
      type: 'string',
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
    # Set execute permissions for modules
    && chmod -R 755 /opt/unity/editors/$version/Editor/Data/PlaybackEngines

#=======================================================================================
# [2021.2.5+] Auto-install linux-server module when module contains "linux"
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(2021.2.(?![0-4](?![0-9]))|2021.[3-9]|202[2-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*linux' \\
  && exit 0 \\
  || unity-hub install-modules --version "$version" --module "linux-server" --childModules | tee /var/log/install-module-linux-server.log && grep 'Missing module' /var/log/install-module-linux-server.log | exit $(wc -l);

#=======================================================================================
# [2021.2.5+] Auto-install windows-server module when module contains "windows"
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(2021.2.(?![0-4](?![0-9]))|2021.[3-9]|202[2-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*windows' \\
  && exit 0 \\
  || unity-hub install-modules --version "$version" --module "windows-server" --childModules | tee /var/log/install-module-windows-server.log && grep 'Missing module' /var/log/install-module-windows-server.log | exit $(wc -l);

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
  && mkdir /usr/bin/unity-editor.d \\
  && echo > ~/.bashrc # start from empty to keep "Validate Android Utils" CI step happy.

#=======================================================================================
# [2019.3.[0-5]-linux-il2cpp] https://github.com/game-ci/docker/issues/76
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^2019.3.[0-5]f.*linux-il2cpp' \\
  && exit 0 \\
  || echo 'export IL2CPP_ADDITIONAL_ARGS=--tool-chain-path=/' >> /usr/bin/unity-editor.d/linux-il2cpp-2019.3.5.and.older.sh

#=======================================================================================
# [2019.3.6+/2019.4.0-linux-il2cpp] https://forum.unity.com/threads/unity-2019-3-linux-il2cpp-player-can-only-be-built-with-linux-error.822210/#post-5633977
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2019.3.[6-9]f\\|2019.3.1[0-9]f\\|2019.4.0\\).*linux-il2cpp' \\
  && exit 0 \\
  || echo 'export IL2CPP_ADDITIONAL_ARGS="--sysroot-path=/ --tool-chain-path=/"' >> /usr/bin/unity-editor.d/linux-il2cpp-2019.3-4.sh

#=======================================================================================
# [2020.x/2020.2.0/2020.2.1-webgl] Support GZip compression: https://github.com/game-ci/docker/issues/75
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2020.1\\|2020.2.0f\\|2020.2.1f\\).*-webgl' \\
  && exit 0 \\
  || : \\
  && wget https://old-releases.ubuntu.com/ubuntu/pool/main/g/gzip/gzip_1.6-5ubuntu2_amd64.deb \\
  && dpkg -i gzip_1.6-5ubuntu2_amd64.deb \\
  && rm gzip_1.6-5ubuntu2_amd64.deb \\
  && echo 'export GZIP=-f' >> /usr/bin/unity-editor.d/webgl-2020.1-2.sh


###########################
#       Extra steps       #
###########################

#=======================================================================================
# [2018.x-android] Install 'Android SDK 26.1.1' and 'Android NDK 16.1.4479499'
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^2018\\.[34].*android' \\
  && exit 0 \\
  || : \\
  # Versions
  && export ANDROID_BUILD_TOOLS_VERSION=28.0.3 \\
  && export ANDROID_NDK_VERSION=16.1.4479499 \\
  \\
  # Environment Variables
  && export ANDROID_INSTALL_LOCATION=\${UNITY_PATH}/Editor/Data/PlaybackEngines/AndroidPlayer \\
  && export ANDROID_SDK_ROOT=\${ANDROID_INSTALL_LOCATION}/SDK \\
  && export ANDROID_HOME=\${ANDROID_SDK_ROOT} \\
  && export ANDROID_NDK_HOME=\${ANDROID_SDK_ROOT}/ndk/\${ANDROID_NDK_VERSION} \\
  && export JAVA_HOME=\${UNITY_PATH}/Editor/Data/PlaybackEngines/AndroidPlayer/Tools/OpenJDK/Linux \\
  && export PATH=$JAVA_HOME/bin:\${ANDROID_SDK_ROOT}/tools:\${ANDROID_SDK_ROOT}/tools/bin:\${ANDROID_SDK_ROOT}/platform-tools:\${PATH} \\
  \\
  # Download Android SDK (commandline tools) 26.1.1
  && mkdir -p \${ANDROID_SDK_ROOT} \\
  && chmod -R 777 \${ANDROID_INSTALL_LOCATION} \\
  && wget -q https://dl.google.com/android/repository/sdk-tools-linux-4333796.zip -O /tmp/android-sdk.zip \\
  && unzip -q /tmp/android-sdk.zip -d \${ANDROID_SDK_ROOT} \\
  \\
  # Install platform-tools, NDK 16.1.4479499 and build-tools 28.0.3
  && yes | sdkmanager \\
    "platform-tools" \\
    "ndk;\${ANDROID_NDK_VERSION}" \\
    "build-tools;\${ANDROID_BUILD_TOOLS_VERSION}" \\
    > /dev/null \\
  \\
  # Accept licenses
  && yes | "\${ANDROID_HOME}/tools/bin/sdkmanager" --licenses \\
  \\
  # Update alias 'unity-editor'
  && { \\
    echo "export ANDROID_SDK_ROOT=\${ANDROID_SDK_ROOT}"; \\
    echo "export ANDROID_HOME=\${ANDROID_HOME}"; \\
    echo "export ANDROID_NDK_HOME=\${ANDROID_NDK_HOME}"; \\
    echo "export JAVA_HOME=\${JAVA_HOME}"; \\
    echo "export PATH=\${PATH}"; \\
  } > /usr/bin/unity-editor.d/android-2018.3-4.sh \\
  # Update '~/.bashrc' to enable using variables when logging in
  && echo ". /usr/bin/unity-editor.d/android-2018.3-4.sh" >> ~/.bashrc

#=======================================================================================
# [2019.x/2020.x/2021.x/2022.x-android] Setup Android SDK and NDK Variables
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^20(?!18).*android' \\
  && exit 0 \\
  || : \\
  # Environment Variables
  && export RAW_ANDROID_SDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-sdk-platform-tools"))).destination' $UNITY_PATH/modules.json) \\
  # We need to replace some characters common to paths that will break the sed expression when expanded
  && export ESCAPED_UNITY_PATH=$(printf '%s' "$UNITY_PATH" | sed 's/[#\\/]/\\\\\\0/g') \\
  && export ANDROID_SDK_ROOT=$(echo $RAW_ANDROID_SDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export ANDROID_HOME=\${ANDROID_SDK_ROOT} \\
  && export RAW_ANDROID_NDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-ndk"))).destination' $UNITY_PATH/modules.json) \\
  && export ANDROID_NDK_HOME=$(echo $RAW_ANDROID_NDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export RAW_JAVA_HOME=$(jq -cr '(.[] | select(.id | contains("android-open-jdk"))).destination' $UNITY_PATH/modules.json) \\
  && export ESCAPED_JAVA_HOME=$(echo $RAW_JAVA_HOME | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  # Unity 2019.x doesn't have the jdk in the modules, so put in a fallback. sdkmanager will fail if invalid
  && export JAVA_HOME=\${ESCAPED_JAVA_HOME:-$UNITY_PATH/Editor/Data/PlaybackEngines/AndroidPlayer/Tools/OpenJDK/Linux} \\
  && export PATH=$JAVA_HOME/bin:\${ANDROID_SDK_ROOT}/tools:\${ANDROID_SDK_ROOT}/tools/bin:\${ANDROID_SDK_ROOT}/platform-tools:\${PATH} \\
  \\
  # Update alias 'unity-editor'
  && { \\
    echo "export ANDROID_SDK_ROOT=\${ANDROID_SDK_ROOT}"; \\
    echo "export ANDROID_HOME=\${ANDROID_HOME}"; \\
    echo "export ANDROID_NDK_HOME=\${ANDROID_NDK_HOME}"; \\
    echo "export JAVA_HOME=\${JAVA_HOME}"; \\
    echo "export PATH=\${PATH}"; \\
  } > /usr/bin/unity-editor.d/android-2019+.sh \\
  # Update '~/.bashrc' to enable using variables when logging in
  && echo ". /usr/bin/unity-editor.d/android-2019+.sh" >> ~/.bashrc

#=======================================================================================
# [2021.x/2022.x/6000+-android] Set CMDLINE Tools Path
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(202[1-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && export ESCAPED_UNITY_PATH=$(printf '%s' "$UNITY_PATH" | sed 's/[#\\/]/\\\\\\0/g') \\
  && export RAW_ANDROID_SDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-sdk-platform-tools")) | .destination) // (.[] | select(.id | contains("android-sdk-ndk-tools")) | .destination)' $UNITY_PATH/modules.json) \\
  && export ANDROID_SDK_ROOT=$(echo $RAW_ANDROID_SDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export ANDROID_HOME=\${ANDROID_SDK_ROOT} \\
  && export RAW_ANDROID_NDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-ndk"))).destination' $UNITY_PATH/modules.json) \\
  && export ANDROID_NDK_HOME=$(echo $RAW_ANDROID_NDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export RAW_CMDLINE_TOOLS_PATH=$(jq -cr '(.[] | select(.id | contains("android-sdk-command-line-tools"))).renameTo' $UNITY_PATH/modules.json) \\
  && export ESCAPED_CMDLINE_TOOLS_PATH=$(echo $RAW_CMDLINE_TOOLS_PATH | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  # Fallback because some Unity versions don't have command line tools in modules.json and sdkmanager fails if invalid
  && export ANDROID_CMDLINE_TOOLS_PATH=\${ESCAPED_CMDLINE_TOOLS_PATH:-$UNITY_PATH/Editor/Data/PlaybackEngines/AndroidPlayer/SDK/tools} \\
  && export RAW_JAVA_HOME=$(jq -cr '(.[] | select(.id | contains("android-open-jdk"))).destination' $UNITY_PATH/modules.json) \\
  && export JAVA_HOME=$(echo $RAW_JAVA_HOME | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  # Prefer cmdline tools over legacy tools
  && export PATH=\${JAVA_HOME}/bin:\${ANDROID_CMDLINE_TOOLS_PATH}/bin:\${PATH} \\
  && { \\
    echo "export ANDROID_SDK_ROOT=\${ANDROID_SDK_ROOT}"; \\
    echo "export ANDROID_HOME=\${ANDROID_HOME}"; \\
    echo "export ANDROID_NDK_HOME=\${ANDROID_NDK_HOME}"; \\
    echo "export JAVA_HOME=\${JAVA_HOME}"; \\
    echo "export ANDROID_CMDLINE_TOOLS_PATH=\${ANDROID_CMDLINE_TOOLS_PATH}"; \\
    echo "export PATH=\${PATH}"; \\
  } > /usr/bin/unity-editor.d/android-2019+.sh \\
  # Update '~/.bashrc' to enable using variables when logging in
  && echo ". /usr/bin/unity-editor.d/android-2019+.sh" >> ~/.bashrc

#=======================================================================================
# [2019.x/2020.x-android] Accept Android SDK licenses via old sdkmanager
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(20(19|20)).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && yes | "\${ANDROID_HOME}/tools/bin/sdkmanager" --licenses

#=======================================================================================
# [2021.x/2022.x/6000+-android] Accept Android SDK licenses via new cmdline-tools sdkmanager
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(202[1-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && yes | "\${ANDROID_CMDLINE_TOOLS_PATH}/bin/sdkmanager" --licenses

#=======================================================================================
# [6000+-android] Install platform-tools if missing
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^([6-9][0-9]{3}|[1-9][0-9]{4,}).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && if [ ! -d "\${ANDROID_HOME}/platform-tools" ]; then \\
    echo "Installing platform-tools..."; \\
    "\${ANDROID_CMDLINE_TOOLS_PATH}/bin/sdkmanager" "platform-tools"; \\
  else \\
    echo "platform-tools already exists at \${ANDROID_HOME}/platform-tools"; \\
  fi

#=======================================================================================
# [2022.2+-android] Fix for symlink issue on Android
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(2022.[2-9]|202[3-9]|20[3-9]).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && cd "\${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin" \\
  # Symlink any file less than 64 bytes to the file name within the file. We assume there are no real files that small
  && for f in $(find . -type f -size -64c); do target=$(cat $f) && echo "Making symlink $f -> $target" && rm $f && ln -s $target $f ; done

#=======================================================================================
# [webgl] Support audio using ffmpeg (~99MB)
#=======================================================================================
RUN echo "$module" | grep -q -v 'webgl' \\
  && exit 0 \\
  || : \\
  && apt-get update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    ffmpeg \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*

#=======================================================================================
# [webgl, il2cpp] build-essential clang
#=======================================================================================
RUN echo "$module" | grep -q -v '\\(webgl\\|linux-il2cpp\\)' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    build-essential \\
    clang \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*

#=======================================================================================
# [2019.x] libnotify4 libunwind-dev libssl1.0.0
#=======================================================================================
RUN echo "$version" | grep -q -v '^2019.' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    libnotify4 \\
    libunwind-dev \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/* \\
  # Install libssl1.0.0
  && wget http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.0.0_1.0.2g-1ubuntu4.20_amd64.deb \\
  && dpkg -i libssl1.0.0_1.0.2g-1ubuntu4.20_amd64.deb \\
  && rm libssl1.0.0_1.0.2g-1ubuntu4.20_amd64.deb

#=======================================================================================
# [2018.x/2019.x/2020.x/2021.1.x-webgl] python2
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2018\\|2019\\|2020\\|2021.1\\).*webgl' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    python-setuptools \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/* \\
  && ln -s /usr/bin/python2 /usr/bin/python

#=======================================================================================
# [2018.x/2019.x/2020.1.x-webgl] support brotli compression for linux
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2018\\|2019\\|2020.1\\).*webgl' \\
  && exit 0 \\
  || : \\
  && cp \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/WebGLSupport/BuildTools/Brotli/dist/Brotli-0.4.0-py2.7-linux-x86_64.egg \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/WebGLSupport/BuildTools/Brotli/dist/Brotli-0.4.0-py2.7-macosx-10.10-x86_64.egg

#=======================================================================================
# [2021.x/2022.x-mac-mono] x64arm64/x64ARM64 case issue https://github.com/game-ci/unity-builder/issues/320
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^202[12].*mac-mono' \\
  && exit 0 \\
  || : \\
  && ln -s \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64arm64_player_nondevelopment_mono \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64ARM64_player_nondevelopment_mono \\
  && ln -s \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64arm64_player_development_mono \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64ARM64_player_development_mono

#=======================================================================================
# [2021.x-linux-il2cpp] lld
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^2021.*linux-il2cpp' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    lld \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*
`;
}

function generateWindowsDockerfile(): string {
  return `ARG baseImage="unityci/base:windows-latest"
ARG hubImage="unityci/hub:windows-latest"

#############
#  Builder  #
#############

FROM $hubImage AS Builder

# Using bash to process unity install
RUN choco install git --no-progress -y

SHELL ["cmd", "/S", "/C"]

RUN setx path "C:\\\\Program Files\\\\Git\\\\bin;%path%"

SHELL ["bash.exe", "-c"]

# Install Editor
ARG version
ARG changeSet

RUN "mkdir -p /var/log && mkdir -p C:/UnityEditor"

RUN "C:/Program\\\\ Files/Unity\\\\ Hub/Unity\\\\ Hub.exe -- --headless install-path --set C:/UnityEditor"

RUN "C:/Program\\\\ Files/Unity\\\\ Hub/Unity\\\\ Hub.exe -- --headless install \\
                                                    --version $version \\
                                                    --changeset $changeSet \\
                                                    | tee /var/log/install-editor.log \\
                                                    && grep 'Error' /var/log/install-editor.log \\
                                                    | exit $(wc -l)"

ARG module
RUN "for mod in $module; do \\
       if [ \"$mod\" = 'base' ]; then \\
         echo 'running default modules for this base OS'; \\
       else \\
         C:/Program\\\\ Files/Unity\\\\ Hub/Unity\\\\ Hub.exe -- --headless install-modules \\
                                                     --version $version \\
                                                     --module \"$mod\" \\
                                                     --childModules \\
                                                     | tee /var/log/install-module-\${mod}.log \\
                                                     && grep 'Missing module' /var/log/install-module-\${mod}.log \\
                                                     | exit $(wc -l); \\
       fi; \\
     done"

############
#  Editor  #
############

FROM $baseImage

SHELL ["powershell.exe", "-Command"]

# Copy the editor from the builder to the final editor image
COPY --from=Builder ["C:/UnityEditor/", "C:/UnityEditor/"]

# Need to grab these dependencies that the editor needs to run
COPY --from=Builder C:/windows/system32/MSVCP100.dll \\
                    C:/windows/system32/MSVCR100.dll \\
                    C:/windows/system32/

# Add version to file at editor path
ARG version
RUN echo "$Env:version" > "C:/UnityEditor/$Env:version/version"

RUN setx -M UNITY_PATH "C:/UnityEditor/$Env:version"

# Packages/manifest.json could have git dependencies
RUN choco install git --no-progress -y

# Unity package manager throws an error about not being in a git directory when
# importing git packages without this
RUN git config --global --add safe.directory "*"

# Need to enable these services to make Unity happy
RUN foreach ("$service" in 'nlasvc', 'netprofm') {"Set-Service $service -StartupType Automatic"}

#=======================================================================================
# [android] Setup Android SDK, NDK, JDK, cmdline tools and accept licenses
#=======================================================================================
# Inline the PowerShell helper functions and setup logic
ARG module
RUN if ("$Env:module" -match 'android|Android') { \\
      # HelperFunctions \\
      function Find-Module { \\
        param($ModuleList, $ModuleID) \\
        $index = $ModuleList.FindIndex({$$args[0].id.contains($ModuleID)}) \\
        return $index -ne -1 \\
      } \\
      function Get-ModuleDestinationPath { \\
        param($ModuleList, $ModuleID, $UnityPath) \\
        $index = $ModuleList.FindIndex({$$args[0].id.contains($ModuleID)}) \\
        $rawPath = $ModuleList[$index].destination \\
        if ($$null -eq $rawPath) { throw "Unable to get a destination path for $ModuleID" } \\
        return $rawPath.Replace('{UNITY_PATH}', $UnityPath) \\
      } \\
      function Get-ModuleRenamedPath { \\
        param($ModuleList, $ModuleID, $UnityPath) \\
        $index = $ModuleList.FindIndex({$$args[0].id.contains($ModuleID)}) \\
        $rawPath = $ModuleList[$index].extractedPathRename.to \\
        if ($$null -eq $rawPath) { $rawPath = $ModuleList[$index].renameTo } \\
        if ($$null -eq $rawPath) { throw "Unable to get a ModuleRenamedPath for $ModuleID" } \\
        return $rawPath.Replace('{UNITY_PATH}', $UnityPath) \\
      } \\
      # SetupAndroid \\
      [void][System.Reflection.Assembly]::LoadWithPartialName("System.Web.Extensions") \\
      $raw_modules = Get-Content "$Env:UNITY_PATH/modules.json" \\
      $UNITY_MODULES_JSON = (New-Object -TypeName System.Web.Script.Serialization.JavaScriptSerializer -Property @{MaxJsonLength=67108864}).DeserializeObject($raw_modules) \\
      $UNITY_MODULES_LIST = [Collections.Generic.List[Object]]($UNITY_MODULES_JSON) \\
      $ANDROID_SDK_ROOT = Get-ModuleDestinationPath $UNITY_MODULES_LIST 'android-sdk-platform-tools' $Env:UNITY_PATH \\
      $ANDROID_NDK_HOME = Get-ModuleDestinationPath $UNITY_MODULES_LIST 'android-ndk' $Env:UNITY_PATH \\
      $JAVA_HOME = Get-ModuleDestinationPath $UNITY_MODULES_LIST 'android-open-jdk' $Env:UNITY_PATH \\
      if (Find-Module $UNITY_MODULES_LIST 'android-sdk-command-line-tools') { \\
        $TOOLS_PATH = Get-ModuleRenamedPath $UNITY_MODULES_LIST 'android-sdk-command-line-tools' $Env:UNITY_PATH \\
      } else { \\
        $TOOLS_PATH = "$ANDROID_SDK_ROOT/tools" \\
      } \\
      $newPath = "$JAVA_HOME/bin;$ANDROID_SDK_ROOT/tools;$TOOLS_PATH/bin;$ANDROID_SDK_ROOT/platform-tools;$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/windows-x86_64/bin;C:/Program Files/Git/bin" \\
      $oldPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine') \\
      [Environment]::SetEnvironmentVariable('PATH', "$newPath;$oldPath", 'Machine') \\
      [Environment]::SetEnvironmentVariable('ANDROID_HOME', "$ANDROID_SDK_ROOT", 'Machine') \\
      [Environment]::SetEnvironmentVariable('ANDROID_NDK_HOME', "$ANDROID_NDK_HOME", 'Machine') \\
      [Environment]::SetEnvironmentVariable('JAVA_HOME', "$JAVA_HOME", 'Machine') \\
      [Environment]::SetEnvironmentVariable('ANDROID_CMDLINE_TOOLS', "$TOOLS_PATH", 'Machine') \\
      New-Item -ItemType file -Path "$Env:USERPROFILE/.android/repositories.cfg" -Force \\
    }

# Accept Android Licenses (separate step so env vars from above are available)
RUN if ("$Env:module" -match 'android|Android') { \\
      Set-Location "$Env:ANDROID_CMDLINE_TOOLS/bin" \\
      bash -c "yes | ./sdkmanager.bat --licenses" \\
    }
`;
}
