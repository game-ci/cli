import { describe, it, expect } from "vitest";
import { generateAppVdf, generateDepotVdf } from "./vdf-generator";

describe("generateDepotVdf", () => {
  it("includes the depot id and default Unity-build file exclusions", () => {
    const vdf = generateDepotVdf({ depotId: "12345" });

    expect(vdf).toContain('"depotid" "12345"');
    expect(vdf).toContain('"FileExclusion"\t"*.pdb"');
    expect(vdf).toContain('"FileExclusion"\t"*_BurstDebugInformation_DoNotShip*"');
    expect(vdf).toContain('"FileExclusion"\t"*_BackUpThisFolder_ButDontShipItWithYourGame*"');
  });

  it("appends extra exclusions without dropping the defaults", () => {
    const vdf = generateDepotVdf({ depotId: "12345", extraExclusions: ["*.debug"] });

    expect(vdf).toContain('"FileExclusion"\t"*.pdb"');
    expect(vdf).toContain('"FileExclusion"\t"*.debug"');
  });

  it("defaults LocalPath to the whole build (./*)", () => {
    const vdf = generateDepotVdf({ depotId: "12345" });

    expect(vdf).toContain('"LocalPath"\t"./*"');
  });

  it("uses a custom localPath when given - for multi-depot builds where each depot maps its own subdirectory", () => {
    const vdf = generateDepotVdf({ depotId: "12345", localPath: "./depot1Path/*" });

    expect(vdf).toContain('"LocalPath"\t"./depot1Path/*"');
  });

  it("omits debug-symbol exclusions when includeDebugSymbols is true - matches steam-deploy's own debugBranch input", () => {
    const vdf = generateDepotVdf({ depotId: "12345", includeDebugSymbols: true });

    expect(vdf).not.toContain('"FileExclusion"\t"*.pdb"');
    expect(vdf).not.toContain("BurstDebugInformation");
    // Always-excluded patterns (not debug-symbol-specific) still apply.
    expect(vdf).toContain('"FileExclusion"\t"*.log"');
  });

  it("adds an InstallScript directive when given", () => {
    const vdf = generateDepotVdf({ depotId: "12345", installScript: "install.vdf" });

    expect(vdf).toContain('"InstallScript" "install.vdf"');
  });

  it("omits the InstallScript directive when not given", () => {
    const vdf = generateDepotVdf({ depotId: "12345" });

    expect(vdf).not.toContain("InstallScript");
  });

  it("emits multiple FileMapping blocks when fileMappings is given, ignoring localPath", () => {
    const vdf = generateDepotVdf({
      depotId: "12345",
      localPath: "./ignored/*",
      fileMappings: [
        { localPath: "bin\\*", depotPath: "executables\\", recursive: true },
        { localPath: "localization\\german\\audio\\*", depotPath: "audio\\", recursive: false },
      ],
    });

    expect(vdf).not.toContain("./ignored/*");
    const mappingCount = vdf.split('"FileMapping"').length - 1;
    expect(mappingCount).toBe(2);
    expect(vdf).toContain('"LocalPath"\t"bin\\*"');
    expect(vdf).toContain('"DepotPath"\t"executables\\"');
    expect(vdf).toContain('"LocalPath"\t"localization\\german\\audio\\*"');
    expect(vdf).toContain('"DepotPath"\t"audio\\"');
  });

  it("defaults a FileMapping's recursive flag to true and its depotPath to the depot root", () => {
    const vdf = generateDepotVdf({
      depotId: "12345",
      fileMappings: [{ localPath: "bin\\*" }],
    });

    expect(vdf).toContain('"DepotPath"\t"."');
    expect(vdf).toContain('"recursive"\t"1"');
  });

  it("sets recursive to 0 when a mapping explicitly opts out", () => {
    const vdf = generateDepotVdf({
      depotId: "12345",
      fileMappings: [{ localPath: "bin\\*", recursive: false }],
    });

    expect(vdf).toContain('"recursive"\t"0"');
  });

  it("emits FileProperties blocks for userconfig/versionedconfig files", () => {
    const vdf = generateDepotVdf({
      depotId: "12345",
      fileProperties: [
        { localPath: "bin/config.cfg", attribute: "userconfig" },
        { localPath: "bin/settings.ini", attribute: "versionedconfig" },
      ],
    });

    expect(vdf).toContain('"FileProperties"');
    expect(vdf).toContain('"LocalPath"\t"bin/config.cfg"');
    expect(vdf).toContain('"Attributes"\t"userconfig"');
    expect(vdf).toContain('"LocalPath"\t"bin/settings.ini"');
    expect(vdf).toContain('"Attributes"\t"versionedconfig"');
  });

  it("omits FileProperties entirely when none are given", () => {
    const vdf = generateDepotVdf({ depotId: "12345" });

    expect(vdf).not.toContain("FileProperties");
  });
});

describe("generateAppVdf", () => {
  it("produces a manifest referencing a single depot VDF file by name", () => {
    const vdf = generateAppVdf({
      appId: "999",
      depots: [{ depotId: "1000", vdfFileName: "depot_build_1000.vdf" }],
      branch: "beta",
      description: "Test build",
    });

    expect(vdf).toContain('"appid" "999"');
    expect(vdf).toContain('"setlive" "beta"');
    expect(vdf).toContain('"desc" "Test build"');
    expect(vdf).toContain('"1000" "depot_build_1000.vdf"');
  });

  it("references every depot when given more than one", () => {
    const vdf = generateAppVdf({
      appId: "999",
      depots: [
        { depotId: "1000", vdfFileName: "depot_build_1000.vdf" },
        { depotId: "1001", vdfFileName: "depot_build_1001.vdf" },
        { depotId: "1002", vdfFileName: "depot_build_1002.vdf" },
      ],
      branch: "default",
      description: "Test build",
    });

    expect(vdf).toContain('"1000" "depot_build_1000.vdf"');
    expect(vdf).toContain('"1001" "depot_build_1001.vdf"');
    expect(vdf).toContain('"1002" "depot_build_1002.vdf"');
  });

  it("throws when given no depots", () => {
    expect(() =>
      generateAppVdf({ appId: "999", depots: [], branch: "default", description: "x" }),
    ).toThrow(/at least one depot/);
  });
});
