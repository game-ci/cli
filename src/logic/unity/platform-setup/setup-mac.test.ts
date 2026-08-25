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
  // Regression test for a real bug: installUnityHub used to build
  // `brew install unity-hub@<version>`, treating Unity Hub as a versioned
  // Homebrew formula. Unity Hub is only distributed as a cask, so that
  // command fails with "No available formula with the name ...". Confirmed
  // live in game-ci/unity-builder CI: every Mac build failed at Unity Hub
  // install with exactly this error before this fix, while the previously
  // working (pre-thin-wrapper) code path ran the plain, unversioned
  // `brew install unity-hub` cask install successfully.
  it("installs the unversioned unity-hub cask when no version is pinned", async () => {
    // Only the Hub paths are missing; the Editor path exists so setup() doesn't also
    // fall into installUnity, which is unrelated to this fix.
    fs.existsSync = mock((path: string) => !path.includes("Hub.app")) as any;
    let capturedCommand = "";
    const systemRunMock = mock((command: string) => {
      capturedCommand = command;

      return Promise.resolve({ status: { code: 0 }, output: "" });
    });
    System.run = systemRunMock as any;

    await SetupMac.setup({
      isRunningLocally: false,
      unityHubVersionOnMac: "",
      engineVersion: "2021.3.16f1",
    } as any);

    expect(capturedCommand).toBe("brew install --cask unity-hub");
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
      unityHubVersionOnMac: "",
      engineVersion: "2021.3.45f2",
      targetPlatform: "StandaloneOSX",
    } as any);

    expect(capturedCommand).toContain("--version 2021.3.45f2");
    expect(capturedCommand).not.toContain("undefined");
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
        unityHubVersionOnMac: "",
        engineVersion: "2021.3.45f2",
        targetPlatform: "StandaloneOSX",
      } as any);
    } finally {
      Object.defineProperty(process, "arch", { value: originalArch, configurable: true });
    }

    expect(capturedCommand).toContain("--architecture arm64");
  });
});
