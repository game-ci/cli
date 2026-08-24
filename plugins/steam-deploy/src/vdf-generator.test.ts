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
});

describe("generateAppVdf", () => {
  it("produces a manifest referencing the depot VDF file by name", () => {
    const vdf = generateAppVdf({
      appId: "999",
      depotId: "1000",
      branch: "beta",
      description: "Test build",
      depotVdfFileName: "depot_build_1000.vdf",
    });

    expect(vdf).toContain('"appid" "999"');
    expect(vdf).toContain('"setlive" "beta"');
    expect(vdf).toContain('"desc" "Test build"');
    expect(vdf).toContain('"1000" "depot_build_1000.vdf"');
  });
});
