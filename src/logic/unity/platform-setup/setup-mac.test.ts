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
});
