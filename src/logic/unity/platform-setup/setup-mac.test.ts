import { describe, it, expect, mock, afterEach } from "bun:test";
import { SetupMac } from "./setup-mac.ts";
import { fsSync as fs } from "../../../dependencies.ts";
import { System } from "../../../model/system/system.ts";

const originalExistsSync = fs.existsSync;
const originalSystemRun = System.run;

afterEach(() => {
  fs.existsSync = originalExistsSync;
  System.run = originalSystemRun;
});

describe("SetupMac", () => {
  // Unity Hub 4 removed the headless `install` command, so CI installs the Editor with the
  // Unity CLI and only installs Unity Hub when a Hub version is pinned.
  it("does not install Unity Hub when no Hub version is pinned", async () => {
    // The Editor path exists, so setup() has nothing to install.
    fs.existsSync = mock((path: string) => !path.includes("Hub.app")) as any;
    const systemRunMock = mock(() => Promise.resolve({ status: { code: 0 }, output: "" }));
    System.run = systemRunMock as any;

    await SetupMac.setup({
      isRunningLocally: false,
      unityHubVersionOnMac: "",
      engineVersion: "2021.3.16f1",
    } as any);

    expect(systemRunMock).not.toHaveBeenCalled();
  });

  it("pins the cask version when unityHubVersionOnMac is explicitly set", async () => {
    fs.existsSync = mock((path: string) => !path.includes("Hub.app")) as any;
    let capturedCommand = "";
    const systemRunMock = mock((command: string) => {
      capturedCommand = command;

      return Promise.resolve({ status: { code: 0 }, output: "" });
    });
    System.run = systemRunMock as any;

    await SetupMac.setup({
      isRunningLocally: false,
      unityHubVersionOnMac: "3.19.5",
      engineVersion: "2021.3.16f1",
    } as any);

    expect(capturedCommand).toBe("brew install --cask unity-hub@3.19.5");
  });

  // Regression test for a real bug: installUnity's --version flag read
  // options.editorVersion, a field nothing ever assigns (only
  // engineVersion is populated - see the engineDetection middleware /
  // game-ci/cli#154). Options is loosely typed, so this typo compiled
  // clean and silently sent "--version undefined" to Unity Hub CLI on
  // every macOS build, producing Hub's own "Provided editor version does
  // not match to any known Unity Editor versions" - confirmed live in
  // game-ci/unity-builder#844's CI across every release from v0.1.17
  // through v0.1.22.
  it("installUnity passes the real engineVersion, not the nonexistent editorVersion field", async () => {
    // Hub path exists so setup() skips installUnityHub and goes straight to
    // installUnity, which is what we're testing here.
    fs.existsSync = mock((path: string) => path.includes("Hub.app")) as any;
    let capturedCommand = "";
    const systemRunMock = mock((command: string) => {
      capturedCommand = command;

      return Promise.resolve({ status: { code: 0 }, output: "" });
    });
    System.run = systemRunMock as any;

    await SetupMac.setup({
      isRunningLocally: false,
      unityHubVersionOnMac: "3.19.5",
      engineVersion: "2021.3.45f2",
      targetPlatform: "StandaloneOSX",
    } as any);

    expect(capturedCommand).toContain("--version 2021.3.45f2");
    expect(capturedCommand).not.toContain("undefined");
    // --changeset is required alongside --version: confirmed via live debug
    // logging that Unity Hub CLI on Apple Silicon rejects an otherwise
    // objectively-real version without it.
    expect(capturedCommand).toContain("--changeset 88f88f591b2e");
  });

  // Regression test: installUnity never passed --architecture at all.
  // Confirmed via live debug logging (#170/v0.1.24) that Unity Hub CLI on a
  // macos-26-arm64 (Apple Silicon) runner still rejects a genuinely correct
  // --version without an explicit --architecture.
  it("installUnity passes --architecture matching process.arch", async () => {
    const originalArch = process.arch;
    Object.defineProperty(process, "arch", { value: "arm64", configurable: true });

    fs.existsSync = mock((path: string) => path.includes("Hub.app")) as any;
    let capturedCommand = "";
    const systemRunMock = mock((command: string) => {
      capturedCommand = command;

      return Promise.resolve({ status: { code: 0 }, output: "" });
    });
    System.run = systemRunMock as any;

    try {
      await SetupMac.setup({
        isRunningLocally: false,
        unityHubVersionOnMac: "3.19.5",
        engineVersion: "2021.3.45f2",
        targetPlatform: "StandaloneOSX",
      } as any);
    } finally {
      Object.defineProperty(process, "arch", { value: originalArch, configurable: true });
    }

    expect(capturedCommand).toContain("--architecture arm64");
  });
});

describe("SetupMac Unity CLI install", () => {
  const runSetup = async (targetPlatform: string) => {
    const originalArch = process.arch;
    Object.defineProperty(process, "arch", { value: "arm64", configurable: true });
    // Neither Unity Hub nor the Editor is installed.
    fs.existsSync = mock(() => false) as any;
    const commands: string[] = [];
    System.run = mock((command: string) => {
      commands.push(command);

      return Promise.resolve({ status: { code: 0 }, output: "" });
    }) as any;

    try {
      await SetupMac.setup({
        isRunningLocally: false,
        unityHubVersionOnMac: "",
        engineVersion: "2021.3.45f2",
        targetPlatform,
      } as any);
    } finally {
      Object.defineProperty(process, "arch", { value: originalArch, configurable: true });
    }

    return commands;
  };

  // Regression test: Homebrew's unity-hub cask now installs Unity Hub 4, which rejects
  // `--headless install` with "'install' is not supported by the native Unity Hub", so every
  // macOS build failed before the Editor was installed.
  it("installs the Editor with the Unity CLI instead of Unity Hub", async () => {
    const commands = await runSetup("StandaloneOSX");

    expect(commands.some((command) => command.includes("brew") || command.includes("Unity Hub"))).toBe(false);
    expect(commands[0]).toContain("curl -fsSL https://public-cdn.cloud.unity3d.com/hub/prod/cli/install.sh");
    expect(commands[2]).toContain('mkdir -p "/Applications/Unity/Hub/Editor" && ');
    expect(commands[2]).toContain('install-path --set "/Applications/Unity/Hub/Editor"');
    const install = commands[3];
    expect(install).toContain("install 2021.3.45f2");
    expect(install).toContain("--changeset 88f88f591b2e");
    expect(install).toContain("--module mac-il2cpp");
    expect(install).toContain("--architecture arm64");
    expect(install).toContain("--accept-eula");
    expect(install).toContain("--non-interactive");
  });

  // The Unity CLI calls the tvOS module "appletv" and skips unknown module IDs with only a warning.
  it("uses the Unity CLI module ID for tvOS", async () => {
    const install = (await runSetup("tvOS"))[3];

    expect(install).toContain("--module appletv");
    expect(install).not.toContain("--module tvos");
  });
});


describe("SetupMac Unity Hub path detection", () => {
  // Regression test for a real bug: unityHubExecPath/unityHubBasePath embed
  // literal double-quote characters (needed when they're later interpolated
  // into a shell command string, to protect the space in "Unity Hub.app"
  // from word splitting). fs.existsSync does a raw filesystem stat with no
  // shell involved, so passing those same quoted strings to it checks for a
  // path that literally contains `"` characters and never exists - even
  // when Unity Hub is genuinely installed at the real, unquoted path.
  // Reported live: a user with Unity Hub installed at the documented
  // default location still got "Unity Hub is not installed at the default
  // location." See game-ci/cli#273.
  it("finds an installed Unity Hub whose real path has no literal quote characters", async () => {
    fs.existsSync = mock(
      (path: string) => path === '/Applications/Unity Hub.app/Contents/MacOS/Unity Hub',
    ) as any;
    System.run = mock(async () => {
      throw new Error("No process should be launched - Unity Hub is already installed");
    }) as any;

    await expect(
      SetupMac.setup({
        isRunningLocally: true,
        engineVersion: "2021.3.45f2",
      } as any),
    ).rejects.toThrow("Unity Editor 2021.3.45f2 is not installed");
  });
});

describe("SetupMac Android signing environment", () => {
  it("forwards documented options and prefers them over deprecated values", async () => {
    const savedEnvironment = { ...process.env };
    fs.existsSync = () => true;
    System.run = mock(async () => { throw new Error("No process should be launched"); }) as any;
    try {
      await SetupMac.setup({
        isRunningLocally: true,
        engineVersion: "2021.3.45f2",
        androidKeystorePassword: "synthetic-store-password",
        androidKeystorePass: "old-store-password",
        androidKeyAlias: "release-alias",
        androidKeyAliasName: "old-alias",
        androidKeyAliasPassword: "synthetic-alias-password",
        androidKeyAliasPass: "old-alias-password",
      } as any);
      expect(process.env.ANDROID_KEYSTORE_PASS).toBe("synthetic-store-password");
      expect(process.env.ANDROID_KEYALIAS_NAME).toBe("release-alias");
      expect(process.env.ANDROID_KEYALIAS_PASS).toBe("synthetic-alias-password");
      expect(System.run).not.toHaveBeenCalled();
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in savedEnvironment)) delete process.env[key];
      }
      Object.assign(process.env, savedEnvironment);
    }
  });
});
