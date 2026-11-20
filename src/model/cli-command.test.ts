import { describe, expect, it } from "bun:test";
import { CliCommand } from "./cli-command.ts";

describe("CliCommand.of", () => {
  it("runs a compiled binary as itself", () => {
    expect(CliCommand.of("/usr/local/bin/game-ci", "/usr/local/bin/game-ci")).toBe("'/usr/local/bin/game-ci'");
  });

  it("runs the script through node", () => {
    expect(CliCommand.of("/usr/bin/node", "/opt/cli/dist/index.js")).toBe("'/usr/bin/node' '/opt/cli/dist/index.js'");
  });

  it("runs the script through bun", () => {
    expect(CliCommand.of("/home/me/.bun/bin/bun", "/opt/cli/src/index.ts")).toBe(
      "'/home/me/.bun/bin/bun' '/opt/cli/src/index.ts'",
    );
  });

  it("recognises a Windows node.exe", () => {
    expect(CliCommand.of("C:\\Program Files\\nodejs\\node.exe", "C:\\cli\\dist\\index.js")).toBe(
      "'C:\\Program Files\\nodejs\\node.exe' 'C:\\cli\\dist\\index.js'",
    );
  });

  it("quotes paths with spaces and single quotes for the shell", () => {
    expect(CliCommand.of("/opt/it's here/game-ci", undefined)).toBe("'/opt/it'\\''s here/game-ci'");
  });
});
