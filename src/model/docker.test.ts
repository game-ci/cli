import { describe, it, expect, mock, afterEach } from "bun:test";
import { Action } from "./action.ts";
import { Docker } from "./docker.ts";
import { System } from "./system/system.ts";
import { UnityBuildValidation } from "./unity/build-validation/unity-build-validation.ts";
import { fsSync as fs } from "../dependencies.ts";

describe("Docker", () => {
  const originalSystemRun = System.run;
  const originalValidateBuild = UnityBuildValidation.validateBuild;

  afterEach(() => {
    System.run = originalSystemRun;
    UnityBuildValidation.validateBuild = originalValidateBuild;
  });

  it("skips build-output validation for activate-only runs (game-ci/unity-activate#111)", async () => {
    // Real bug: validateBuild() requires a "# Build results #" section,
    // which only a real build ever produces - it threw on every successful
    // activation, since there's nothing to build.
    System.run = mock(() => Promise.resolve({ output: "Activation complete.", error: "" }));
    const validateBuildMock = mock(() => {});
    UnityBuildValidation.validateBuild = validateBuildMock;

    await Docker.run("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      hostPlatform: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      activateOnly: true,
    } as any);

    expect(validateBuildMock).not.toHaveBeenCalled();
  });

  it("still validates build output for real (non-activate-only) builds", async () => {
    System.run = mock(() => Promise.resolve({ output: "# Build results #\nErrors: 0\nSize:", error: "" }));
    const validateBuildMock = mock(() => {});
    UnityBuildValidation.validateBuild = validateBuildMock;

    await Docker.run("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      hostPlatform: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    } as any);

    expect(validateBuildMock).toHaveBeenCalled();
  });
  it("builds a continuous Linux docker command", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      runnerTempPath: "/home/runner/work/_temp",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      unityLicense: "ci-stub-license",
      engineVersion: "2019.4.40f1",
      projectPath: "test-project",
      targetPlatform: "StandaloneLinux64",
      buildName: "StandaloneLinux64",
      buildPath: "build/StandaloneLinux64",
      buildFile: "StandaloneLinux64",
    });

    expect(command).toContain('--env UNITY_LICENSE="ci-stub-license"');
    expect(command).toContain('--volume "/home/runner":"/root:z"');
    expect(command).toContain('--volume "/home/runner/work/cli/cli":"/github/workspace:z"');
    expect(command).toContain("game-ci/unity-editor-stub:latest");
    expect(command).toContain("/bin/bash /entrypoint.sh");
    expect(command).not.toContain("\n");
  });

  it("uses the engine-supplied commands instead of the Unity entrypoint for non-Unity engines", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/godot:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      runnerTempPath: "/home/runner/work/_temp",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "godot",
      projectPath: "test-project",
      commands: 'godot --headless --export-release "Linux" build/output',
    });

    expect(command).toContain('godot --headless --export-release "Linux" build/output');
    expect(command).not.toContain("/bin/bash /entrypoint.sh");
    expect(command).not.toContain("--env UNITY_SERIAL");
    expect(command).not.toContain("entrypoint.sh:/entrypoint.sh");
  });

  it("still uses the Unity entrypoint when engine is unity even if commands happens to be set", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      runnerTempPath: "/home/runner/work/_temp",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      commands: "should-not-be-used",
    });

    expect(command).toContain("/bin/bash /entrypoint.sh");
    expect(command).not.toContain("should-not-be-used");
  });

  it("leaves the Godot commands string byte-identical when engineLaunchWrapper is unset", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/godot:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      runnerTempPath: "/home/runner/work/_temp",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "godot",
      projectPath: "test-project",
      commands: 'godot --headless --export-release "Linux" build/output',
    });

    expect(command).toContain('game-ci/godot:latest godot --headless --export-release "Linux" build/output');
  });

  it("prefixes the Godot commands string with engineLaunchWrapper when set (Linux)", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/godot:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      runnerTempPath: "/home/runner/work/_temp",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "godot",
      projectPath: "test-project",
      commands: 'godot --headless --export-release "Linux" build/output',
      engineLaunchWrapper: "flock /tmp/engine.lock --",
    });

    expect(command).toContain(
      'game-ci/godot:latest flock /tmp/engine.lock -- godot --headless --export-release "Linux" build/output',
    );
  });

  it("prefixes the Godot commands string with engineLaunchWrapper when set (Windows)", () => {
    const command = (Docker as any).getWindowsCommand("game-ci/godot:latest", {
      currentWorkDir: "C:/work/cli",
      homeDir: "C:/Users/runner",
      cliDistPath: "C:/work/cli/dist",
      cliStoragePath: "C:/work/.game-ci",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "godot",
      commands: 'godot --headless --export-release "Windows" build/output',
      engineLaunchWrapper: "flock /tmp/engine.lock --",
    });

    expect(command).toContain('flock /tmp/engine.lock -- godot --headless --export-release "Windows" build/output');
  });

  it("does not affect the Unity entrypoint flow even when engineLaunchWrapper is set (wrapping happens per-call-site inside the scripts instead)", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      engineLaunchWrapper: "flock /tmp/engine.lock --",
    });

    expect(command).toContain("/bin/bash /entrypoint.sh");
    expect(command).toContain('--env ENGINE_LAUNCH_WRAPPER="flock /tmp/engine.lock --"');
  });

  it("applies docker resource limits and host networking when set", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      dockerCpuLimit: "4",
      dockerMemoryLimit: "8192m",
      dockerShmSize: "1024m",
      useHostNetwork: true,
    });

    expect(command).toContain("--cpus=4");
    expect(command).toContain("--memory=8192m");
    expect(command).toContain("--shm-size=1024m");
    expect(command).toContain("--net=host");
  });

  it("omits --shm-size when dockerShmSize is not set (game-ci/unity-test-runner#307)", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    });

    expect(command).not.toContain("--shm-size");
  });

  it("mounts a custom SSH public keys directory instead of the known_hosts fallback", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "/ssh-agent",
      sshPublicKeysDirectoryPath: "/home/runner/.ssh/keys",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    });

    expect(command).toContain("--volume /home/runner/.ssh/keys:/root/.ssh:ro");
    expect(command).not.toContain("known_hosts");
  });

  it("mounts sshPublicKeysDirectoryPath even without sshAgent set, matching unity-builder", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      sshPublicKeysDirectoryPath: "/home/runner/.ssh/keys",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    });

    expect(command).toContain("--volume /home/runner/.ssh/keys:/root/.ssh:ro");
  });

  it("applies docker resource limits and isolation mode on Windows", () => {
    const command = (Docker as any).getWindowsCommand("game-ci/unity-editor-stub:latest", {
      currentWorkDir: "C:/work/cli",
      homeDir: "C:/Users/runner",
      cliDistPath: "C:/work/cli/dist",
      cliStoragePath: "C:/work/.game-ci",
      unitySerial: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      dockerCpuLimit: "4",
      dockerMemoryLimit: "8192m",
      dockerShmSize: "1024m",
      dockerIsolationMode: "process",
    });

    expect(command).toContain("--cpus=4");
    expect(command).toContain("--memory=8192m");
    expect(command).toContain("--shm-size=1024m");
    expect(command).toContain("--isolation=process");
  });

  // Regression test for a real bug: GitHub-hosted windows-2022/windows-latest
  // runners only have VS2022 (which installs to "Program Files", not
  // "Program Files (x86)" like every earlier VS version), but the Windows
  // Docker command only ever mounted the (x86) path into the container -
  // silently carrying no real compiler toolchain in, and failing IL2CPP
  // builds with "Could not set up a toolchain for Architecture x64" deep
  // inside the build, long after the container started successfully.
  it("mounts the VS2022-generation (non-x86) Visual Studio path when it exists on the host", () => {
    const originalExistsSync = fs.existsSync;
    fs.existsSync = mock((checkedPath: string) => checkedPath === "C:/Program Files/Microsoft Visual Studio") as any;

    const command = (Docker as any).getWindowsCommand("game-ci/unity-editor-stub:latest", {
      currentWorkDir: "C:/work/cli",
      homeDir: "C:/Users/runner",
      cliDistPath: "C:/work/cli/dist",
      cliStoragePath: "C:/work/.game-ci",
      unitySerial: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    });

    fs.existsSync = originalExistsSync;

    expect(command).toContain(
      '--volume="C:/Program Files/Microsoft Visual Studio":"C:/Program Files/Microsoft Visual Studio"',
    );
    // Still mounts the legacy (x86) path too, unconditionally, for hosts with an older VS generation.
    expect(command).toContain(
      '--volume="C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio"',
    );
  });

  it("omits the VS2022 mount (rather than a Docker bind-mount error) when that path does not exist on the host", () => {
    const originalExistsSync = fs.existsSync;
    fs.existsSync = mock(() => false) as any;

    const command = (Docker as any).getWindowsCommand("game-ci/unity-editor-stub:latest", {
      currentWorkDir: "C:/work/cli",
      homeDir: "C:/Users/runner",
      cliDistPath: "C:/work/cli/dist",
      cliStoragePath: "C:/work/.game-ci",
      unitySerial: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    });

    fs.existsSync = originalExistsSync;

    expect(command).not.toContain('"C:/Program Files/Microsoft Visual Studio"');
  });

  // Regression test for a real bug: dist/test-standalone-scripts holds the
  // Editor/Player helper scripts that --testPlatforms=standalone copies into
  // the project, and ubuntu/steps/test.sh reads them from
  // /UnityTestRunnerAction - but nothing ever mounted them there, so a
  // standalone Docker test run died on `cp -R`. The original
  // unity-test-runner action mounted the same directory; only the mount was
  // lost in the port to this CLI.
  it("mounts the standalone test helper scripts for a Linux test run", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      runTests: true,
    });

    expect(command).toContain(
      '--volume "/home/runner/work/cli/cli/dist/test-standalone-scripts:/UnityTestRunnerAction:z"',
    );
  });

  it("does not mount the standalone test helper scripts for a plain Linux build", () => {
    const command = (Docker as any).getLinuxCommand("game-ci/unity-editor-stub:latest", {
      hostOS: "linux",
      currentWorkDir: "/home/runner/work/cli/cli",
      homeDir: "/home/runner",
      cliDistPath: "/home/runner/work/cli/cli/dist",
      sshAgent: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    });

    expect(command).not.toContain("UnityTestRunnerAction");
  });

  it("mounts the standalone test helper scripts for a Windows test run", () => {
    const command = (Docker as any).getWindowsCommand("game-ci/unity-editor-stub:latest", {
      currentWorkDir: "C:/work/cli",
      homeDir: "C:/Users/runner",
      cliDistPath: "C:/work/cli/dist",
      cliStoragePath: "C:/work/.game-ci",
      unitySerial: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
      runTests: true,
    });

    expect(command).toContain('--volume="C:/work/cli/dist/test-standalone-scripts":"c:/UnityTestRunnerAction"');
    // The whole platforms/windows tree is mounted at c:/steps, which is what
    // puts the shared steps/test.ps1 entrypoint.ps1 dot-sources in reach.
    expect(command).toContain('--volume="C:/work/cli/dist/platforms/windows":"c:/steps"');
  });

  it("does not mount the standalone test helper scripts for a plain Windows build", () => {
    const command = (Docker as any).getWindowsCommand("game-ci/unity-editor-stub:latest", {
      currentWorkDir: "C:/work/cli",
      homeDir: "C:/Users/runner",
      cliDistPath: "C:/work/cli/dist",
      cliStoragePath: "C:/work/.game-ci",
      unitySerial: "",
      gitPrivateToken: "",
      dockerWorkspacePath: "/github/workspace",
      engine: "unity",
    });

    expect(command).not.toContain("UnityTestRunnerAction");
  });

  it.skip("runs", async () => {
    const image = "unity-builder:2019.2.11f1-webgl";
    const parameters = {
      workspace: Action.rootFolder,
      projectPath: `${Action.rootFolder}/test-project`,
      buildName: "someBuildName",
      buildsPath: "build",
      method: "",
    };
    await Docker.run(image, parameters);
  });
});
