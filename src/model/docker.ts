import { ImageEnvironmentFactory } from "./image-environment-factory.ts";
import { path, fsSync as fs } from "../dependencies.ts";
import type { Options } from "../dependencies.ts";
import { System } from "./system/system.ts";
import { UnityBuildValidation } from "./unity/build-validation/unity-build-validation.ts";
import { UnityEnvironment } from "../logic/unity/environment.ts";
import { SecretRedaction } from "./secret-redaction.ts";

/** UNITY_LICENSE/ANDROID_* etc. only make sense inside a Unity container. */
function engineEnvVars(options: Options) {
  return options.engine === "unity" ? UnityEnvironment.getVariables(options) : [];
}

/**
 * dockerShmSize defaults to 1025m because Unity 6.6+ editors request 1GiB of
 * shared memory and hard-fail against Docker's 64m default. "0"/"none" is the
 * escape hatch: omit --shm-size entirely and let Docker apply its own default.
 */
function resolveShmSize(dockerShmSize?: string): string {
  const value = String(dockerShmSize ?? "").trim();

  return value === "" || value === "0" || value.toLowerCase() === "none" ? "" : value;
}

class Docker {
  // Docker Desktop for Windows can run either Windows or Linux containers,
  // and a Windows host with Docker in Linux-containers mode still needs
  // Linux-style image tags, workdir paths, and command shape - the container
  // runtime is Linux regardless of the host OS. `docker version --format
  // '{{.Server.Os}}'` reports what the daemon is actually running, which is
  // the correct signal here, not the host OS (see Cli.resolveHostOS()).
  static async detectDaemonOs(): Promise<string | undefined> {
    try {
      const result = await System.run(`docker version --format "{{.Server.Os}}"`, undefined, { silent: true });
      const daemonOs = (result.output || "").trim().toLowerCase();

      return daemonOs === "windows" || daemonOs === "linux" ? daemonOs : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Real bug: `game-ci build [projectPath]` documents a path argument, but the
   * only host directory ever mounted into the container is the CLI's *current
   * working directory* (see the `--volume "${currentWorkDir}"` lines below) -
   * never projectPath. Host-side checks (e.g. GodotBuildCommand's
   * existsSync(projectPath/export_presets.cfg)) do look at the real
   * projectPath, so pointing the CLI at a project outside the cwd produces a
   * silent mismatch: the container is handed some unrelated directory and the
   * engine fails deep inside the build for reasons that have nothing to do
   * with the actual cause.
   *
   * This bit us in our own real-project-examples CI job, which mounted the
   * game-ci/cli repo instead of the Godot game and got "Can't run project: no
   * main scene defined in the project." from a project that plainly defines
   * one - four wrong diagnoses before the mount was spotted.
   *
   * Changing what gets mounted is a bigger design question (it would move
   * Unity's -projectPath resolution and every relative path like buildsPath),
   * so this only fails fast with an explanation instead.
   */
  private static assertProjectPathIsMounted(options: Options) {
    const { currentWorkDir, projectPath } = options as Options & { projectPath?: string };

    // Both are optional in practice (unit tests, engines that never set one),
    // and a check that can't be evaluated shouldn't be enforced.
    if (!currentWorkDir || !projectPath) return;

    const workDir = path.resolve(currentWorkDir);
    // A relative projectPath is relative to the cwd, which is currentWorkDir.
    const projectDir = path.resolve(workDir, projectPath);

    // path.relative() is the portable containment test: it normalizes
    // separators and, on Windows, compares case-insensitively (so "C:\Work"
    // and "c:\work" match). Inside means "" (same directory) or a relative
    // result that doesn't climb out of workDir.
    const relative = path.relative(workDir, projectDir);
    const isInsideWorkDir =
      relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));

    if (isInsideWorkDir) return;

    throw new Error(String.dedent`
      The project path is outside the current working directory.

        project path:      ${projectDir}
        working directory: ${workDir}

      Only the working directory is mounted into the Docker container, so the
      container would not contain the project at all - the build would fail
      later on for reasons unrelated to the real cause.

      Run game-ci from inside the project (or from a parent directory of it):
        cd ${projectDir}
        game-ci build
    `);
  }

  static async run(image: string, options: Options) {
    const { hostPlatform, hostOS, engine, activateOnly, runTests } = options;

    this.assertProjectPathIsMounted(options);

    log.warning(`running docker process for ${hostOS} (${hostPlatform})`);

    let command = "";
    switch (hostOS) {
      case "windows": {
        // Todo: check if docker daemon is set for Windows or Linux containers.
        command = await this.getWindowsCommand(image, options);
        break;
      }
      case "linux":
      case "darwin": {
        command = await this.getLinuxCommand(image, options);
        break;
      }
    }

    try {
      // Redacted: this string contains every --env value verbatim, including
      // UNITY_PASSWORD. See SecretRedaction.
      if (log.isVeryVerbose) log.debug(`docker command: ${SecretRedaction.redact(command)}`);

      // Multiline values (a .ulf's XML) are emitted as bare `--env NAME`, so
      // the docker client has to inherit them from its own environment - see
      // ImageEnvironmentFactory.getInheritedEnvVars.
      const dockerRun = await System.run(command, undefined, {
        env: ImageEnvironmentFactory.getInheritedEnvVars(options, engineEnvVars(options)),
      });

      // Real bug (game-ci/unity-activate#111): validateBuild() requires a
      // "# Build results #" section, which only ever appears after a real
      // build. An activate-only run never produces one - it was throwing
      // "There was an error building the project" on every successful
      // activation, because there's no build to validate in the first place.
      //
      // A test run (game-ci/unity-test-runner#310) has exactly the same
      // shape and was missed by that fix: `game-ci test --docker` produces
      // NUnit results, never a "# Build results #" section, so a fully
      // passing suite ("result=Passed total=5 passed=5") was still being
      // reported as `There was an error building the project`. Test
      // outcomes are validated from the results XML by the caller, not from
      // build-log scraping, so there is nothing for validateBuild to do here.
      switch (engine) {
        case "unity":
          if (!activateOnly && !runTests) {
            UnityBuildValidation.validateBuild(dockerRun.output);
          }
          break;
      }
    } catch (error: any) {
      // Unity prints this from inside the container when /dev/shm is too
      // small for it (6.6+ editors ask for 1GiB against Docker's 64m
      // default). The raw message tells you to pass --shm-size to `docker
      // run`, which is useless advice when it's game-ci running Docker for
      // you - so translate it into the knob that actually exists here.
      if (error.message.includes("Insufficient shared memory available")) {
        const requested = resolveShmSize(options.dockerShmSize as string | undefined);

        throw new Error(String.dedent`
          Unity ran out of shared memory (/dev/shm) inside the container.

          game-ci passed ${requested ? `--shm-size=${requested}` : "no --shm-size, so Docker's 64m default applied"}.

          Unity 6.6 and newer request 1GiB of shared memory. Raise it with:
            game-ci build --docker-shm-size 2g
          or, in a GitHub Actions workflow:
            with:
              dockerShmSize: 2g

          See game-ci/unity-builder#840 and game-ci/unity-test-runner#307.

          Original error:
          ${error.message}
        `);
      }

      if (error.message.includes('docker: image operating system "windows" cannot be used on this platform')) {
        throw new Error(String.dedent`
          Docker daemon is not set to run Windows containers.

          To enable the Hyper-V container backend run:
            Enable-WindowsOptionalFeature -Online -FeatureName $("Microsoft-Hyper-V", "Containers") -All

          To switch the docker daemon to run Windows containers run:
            & $Env:ProgramFiles\\Docker\\Docker\\DockerCli.exe -SwitchDaemon .

          For more information see:
            https://docs.microsoft.com/en-us/virtualization/windowscontainers/quick-start/set-up-environment?tabs=dockerce#prerequisites
        `);
      }

      throw error;
    }
  }

  private static getLinuxCommand(image: string, options: Options): string {
    const {
      currentWorkDir,
      homeDir,
      cliDistPath,
      runnerTempPath,
      sshAgent,
      sshPublicKeysDirectoryPath,
      gitPrivateToken,
      // Only registered as a CLI flag for Unity's build/test/activate
      // commands (see build-options.ts, docker-test-options.ts,
      // activate-command.ts) - Godot/Unreal builds never set it, which
      // previously produced a literal `--workdir undefined` Docker rejects.
      dockerWorkspacePath = "/github/workspace",
      commands,
      engine,
      useHostNetwork,
      dockerCpuLimit,
      dockerMemoryLimit,
      dockerShmSize,
      engineLaunchWrapper,
      runTests,
    } = options as Options & { commands?: string };

    const home = homeDir;
    const envVarString = ImageEnvironmentFactory.getEnvVarString(options, engineEnvVars(options)).replace(
      / \\\n/g,
      " ",
    );

    // Non-Unity engines (Godot, Unreal) supply their own container command
    // via `commands` instead of Unity's license-activate-build-return
    // entrypoint.sh flow — this used to be silently ignored here, so any
    // build with `engine !== 'unity'` always ran Unity's entrypoint instead
    // of the command the engine plugin actually asked for.
    const isUnityDefaultFlow = !commands || engine === "unity";

    // Non-Unity engines' `commands` is already just the engine invocation
    // itself (no surrounding activate/build/return-license lifecycle), so a
    // single prefix here is exactly as precise a wrap as the per-call-site
    // fix inside entrypoint.sh's step scripts is for Unity. Unset (the
    // default) leaves `commands` byte-identical to today.
    const wrappedCommands = engineLaunchWrapper && commands ? `${engineLaunchWrapper} ${commands}` : commands;

    return [
      "docker run",
      "--rm",
      `--workdir ${dockerWorkspacePath}`,
      envVarString,
      isUnityDefaultFlow ? "--env UNITY_SERIAL" : "",
      `--env GITHUB_WORKSPACE=${dockerWorkspacePath}`,
      gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : "",
      sshAgent ? "--env SSH_AUTH_SOCK=/ssh-agent" : "",
      dockerCpuLimit ? `--cpus=${dockerCpuLimit}` : "",
      dockerMemoryLimit ? `--memory=${dockerMemoryLimit}` : "",
      resolveShmSize(dockerShmSize) ? `--shm-size=${resolveShmSize(dockerShmSize)}` : "",
      useHostNetwork ? "--net=host" : "",
      `--volume "${home}":"/root:z"`,
      `--volume "${currentWorkDir}":"${dockerWorkspacePath}:z"`,
      isUnityDefaultFlow ? `--volume "${cliDistPath}/default-build-script:/UnityBuilderAction:z"` : "",
      isUnityDefaultFlow ? `--volume "${cliDistPath}/platforms/ubuntu/steps:/steps:z"` : "",
      isUnityDefaultFlow ? `--volume "${cliDistPath}/platforms/ubuntu/entrypoint.sh:/entrypoint.sh:z"` : "",
      isUnityDefaultFlow ? `--volume "${cliDistPath}/unity-config:/usr/share/unity3d/config:z"` : "",
      // --testPlatforms=standalone copies these Editor/Player helper scripts
      // into the project before building the standalone test player. Without
      // this mount, test.sh's `cp -R "/UnityTestRunnerAction/Assets/..."`
      // fails outright, so standalone was silently unrunnable in Docker mode.
      // The original unity-test-runner action mounted the same directory (as
      // /UnityStandaloneScripts) - only the mount was lost in the port to the
      // CLI, not the scripts themselves.
      isUnityDefaultFlow && runTests
        ? `--volume "${cliDistPath}/test-standalone-scripts:/UnityTestRunnerAction:z"`
        : "",
      sshAgent ? `--volume ${sshAgent}:/ssh-agent` : "",
      sshAgent && !sshPublicKeysDirectoryPath ? "--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro" : "",
      sshPublicKeysDirectoryPath ? `--volume ${sshPublicKeysDirectoryPath}:/root/.ssh:ro` : "",
      image,
      isUnityDefaultFlow ? "/bin/bash /entrypoint.sh" : wrappedCommands!,
    ]
      .filter(Boolean)
      .join(" ");
  }

  private static getWindowsCommand(image: string, options: Options): string {
    const {
      currentWorkDir,
      homeDir,
      cliDistPath,
      unitySerial,
      gitPrivateToken,
      cliStoragePath,
      dockerWorkspacePath,
      commands,
      engine,
      dockerCpuLimit,
      dockerMemoryLimit,
      dockerShmSize,
      dockerIsolationMode,
      engineLaunchWrapper,
      runTests,
    } = options as Options & { commands?: string };

    // Same "don't force Unity's flow onto a non-Unity engine" fix as
    // getLinuxCommand — see the comment there. No engine currently ships a
    // Windows Docker build path other than Unity, but guard it the same way
    // for consistency and so a future one isn't silently broken like this
    // was.
    const isUnityDefaultFlow = !commands || engine === "unity";

    // See getLinuxCommand's own comment - same single top-level wrap,
    // byte-identical to today when engineLaunchWrapper is unset.
    const wrappedCommands = engineLaunchWrapper && commands ? `${engineLaunchWrapper} ${commands}` : commands;

    // Visual Studio 2022 installs to "Program Files" (it's the first native
    // 64-bit VS release), not "Program Files (x86)" where every earlier VS
    // version lived - and where the container mount below still points.
    // GitHub-hosted windows-2022/windows-latest runners only have VS2022, so
    // that mount silently carries no real compiler toolchain into the
    // container: IL2CPP's "Could not set up a toolchain for Architecture x64"
    // failure is this, not a genuinely missing VS install on the runner.
    // Guarded by existsSync (like the registry-keys fix) so hosts without a
    // VS2022-generation install at this path aren't handed a Docker bind
    // mount for a source path that doesn't exist.
    const vs2022Path = "C:/Program Files/Microsoft Visual Studio";
    const vs2022Mount =
      isUnityDefaultFlow && fs.existsSync(vs2022Path) ? `  --volume="${vs2022Path}":"${vs2022Path}" \`` : "";

    // Note: the equals sign (=) is needed in Powershell.
    // Note: homedir is currently not configured for windows (yet).
    return [
      "docker run `",
      "  --rm `",
      `  --workdir="c:${dockerWorkspacePath}" \``,
      `  ${ImageEnvironmentFactory.getEnvVarString(options, engineEnvVars(options))} \``,
      isUnityDefaultFlow ? `  --env UNITY_SERIAL="${unitySerial}" \`` : "",
      `  --env GITHUB_WORKSPACE=c:${dockerWorkspacePath} \``,
      `  --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \``,
      dockerCpuLimit ? `  --cpus=${dockerCpuLimit} \`` : "",
      dockerMemoryLimit ? `  --memory=${dockerMemoryLimit} \`` : "",
      resolveShmSize(dockerShmSize) ? `  --shm-size=${resolveShmSize(dockerShmSize)} \`` : "",
      dockerIsolationMode ? `  --isolation=${dockerIsolationMode} \`` : "",
      `  --volume="${currentWorkDir}":"c:${dockerWorkspacePath}" \``,
      isUnityDefaultFlow ? `  --volume="${cliStoragePath}/registry-keys":"c:/registry-keys" \`` : "",
      isUnityDefaultFlow
        ? '  --volume="C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" `'
        : "",
      vs2022Mount,
      isUnityDefaultFlow
        ? '  --volume="C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" `'
        : "",
      isUnityDefaultFlow
        ? '  --volume="C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" `'
        : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/default-build-script":"c:/UnityBuilderAction" \`` : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/platforms/windows":"c:/steps" \`` : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/BlankProject":"c:/BlankProject" \`` : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/unity-config":"c:/ProgramData/Unity/config" \`` : "",
      // Windows counterpart of getLinuxCommand's own
      // /UnityTestRunnerAction mount - see the comment there. Consumed by
      // platforms/windows/steps/test.ps1's $TestRunnerActionDir fallback.
      isUnityDefaultFlow && runTests
        ? `  --volume="${cliDistPath}/test-standalone-scripts":"c:/UnityTestRunnerAction" \``
        : "",
      `  ${image} \``,
      isUnityDefaultFlow ? "  powershell c:/steps/entrypoint.ps1" : `  ${wrappedCommands}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
}

export { Docker };
