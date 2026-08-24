import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";
import { spawn } from "node:child_process";
import { Cli } from "./cli.ts";
import { UnityOrchestrateCommand } from "./command/orchestrate/unity-orchestrate-command.ts";
import { CommandFactory } from "./command/command-factory.ts";
import { unityPlugin } from "./plugin/builtin/unity-plugin.ts";
import { PluginRegistry } from "./plugin/plugin-registry.ts";

describe("Cli plugin loading", () => {
  beforeEach(() => {
    PluginRegistry.reset();
  });

  afterEach(() => {
    PluginRegistry.reset();
  });

  it("loads executable plugins from the --plugin flag during setup", async () => {
    const cli = new Cli(["--plugin", `executable:${process.execPath}`], process.cwd());

    await cli.setup();

    expect(PluginRegistry.getAvailableProviders()).toContain("cli-protocol");
    expect(PluginRegistry.getRegisteredPlugins().some((plugin) => plugin.name.startsWith("executable:"))).toBe(true);
  });

  // Regression test: orchestrator used to be registered via a static,
  // compile-time import straight into plugins/orchestrator's internals
  // (`from '../plugins/orchestrator/src/cli-plugin/index.ts'`) - core
  // depending directly on a plugin, not "loaded using a mechanism" the way
  // every other plugin is. It's now loaded through PluginLoader.load(),
  // resolved by its public package name/export map, same as any
  // externally-loaded plugin - it's just always in the default load list.
  it("loads orchestrator through PluginLoader by package name during default setup (not a static import)", async () => {
    const cli = new Cli([], process.cwd());

    await cli.setup();

    expect(PluginRegistry.getRegisteredPlugins().some((plugin) => plugin.name === "orchestrator")).toBe(true);
  });

  it("loads steam-deploy through PluginLoader and resolves `deploy steam` without engine detection", async () => {
    const cli = new Cli([], process.cwd());

    await cli.setup();

    expect(PluginRegistry.getRegisteredPlugins().some((plugin) => plugin.name === "steam-deploy")).toBe(true);

    // No engine detected (Engine.unknown) - deploy must resolve via the '*'
    // wildcard bypass in CommandFactory, not the normal engine-scoped path.
    const command = new CommandFactory().createCommand(["deploy", "steam"]);
    expect(command.name).toBe("Deploy steam");
  });

  it("loads executable plugins from config during setup", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "game-ci-cli-"));
    try {
      await fs.writeFile(
        path.join(tempDir, ".game-ci.yml"),
        `cliOptions:
  plugins:
    - executable:${process.execPath}
`,
        "utf8",
      );

      const cli = new Cli([], tempDir);

      await cli.setup();

      expect(PluginRegistry.getAvailableProviders()).toContain("cli-protocol");
      expect(PluginRegistry.getRegisteredPlugins().some((plugin) => plugin.name.startsWith("executable:"))).toBe(true);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not register built-in plugins more than once", async () => {
    const cli = new Cli([], process.cwd());

    await cli.setup();
    await cli.setup();

    const pluginNames = PluginRegistry.getRegisteredPlugins().map((plugin) => plugin.name);
    expect(pluginNames.filter((name) => name === "unity")).toHaveLength(1);
    expect(pluginNames.filter((name) => name === "godot")).toHaveLength(1);
    expect(pluginNames.filter((name) => name === "unreal")).toHaveLength(1);
  });

  it("supports orchestrate as the preferred provider-backed command", async () => {
    await PluginRegistry.register(unityPlugin);

    const command = new CommandFactory().selectEngine("unity", "2022.3.20f1").createCommand(["orchestrate"]);

    expect(command).toBeInstanceOf(UnityOrchestrateCommand);
  });

  it("keeps remote run as a backwards-compatible alias", async () => {
    await PluginRegistry.register(unityPlugin);

    const command = new CommandFactory().selectEngine("unity", "2022.3.20f1").createCommand(["remote", "run"]);

    expect(command).toBeInstanceOf(UnityOrchestrateCommand);
  });

  it("keeps remote build as a backwards-compatible alias", async () => {
    await PluginRegistry.register(unityPlugin);

    const command = new CommandFactory().selectEngine("unity", "2022.3.20f1").createCommand(["remote", "build"]);

    expect(command).toBeInstanceOf(UnityOrchestrateCommand);
  });
});

describe("Cli env var option mapping", () => {
  // Secrets (Unity credentials, license contents) must reach the CLI via
  // environment variables, not argv - argv can leak through process
  // listings and gets echoed by exec loggers. UnityOptions defaults each
  // credential option to its matching UNITY_* env var (see
  // unity-options.ts) rather than using yargs' blanket .env(), which
  // combined with strict(true) rejects every unrelated process env var as
  // an unrecognized argument.
  it("populates unityEmail from the UNITY_EMAIL env var", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "game-ci-cli-"));
    try {
      await fs.mkdir(path.join(tempDir, "ProjectSettings"), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, "ProjectSettings", "ProjectVersion.txt"),
        "m_EditorVersion: 2022.3.20f1\n",
        "utf8",
      );
      // vcsDetection shells out to git and throws if the project path isn't a repo.
      await new Promise((resolve, reject) => {
        const child = spawn("git", ["init", tempDir]);
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0 ? resolve(undefined) : reject(new Error(`git init exited with ${code}`)),
        );
      });

      const previousEmail = process.env.UNITY_EMAIL;
      process.env.UNITY_EMAIL = "bot@game.ci";
      try {
        const cli = new Cli(["activate", tempDir], process.cwd());
        await cli.setup();
        await cli.registerCommands();
        await cli.registerSchemaForChosenCommand();
        const { options } = await cli.validateAndParseArguments();

        expect(options.unityEmail).toBe("bot@game.ci");
      } finally {
        if (previousEmail === undefined) delete process.env.UNITY_EMAIL;
        else process.env.UNITY_EMAIL = previousEmail;
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("Cli config profiles", () => {
  // Mirrors the ProjectSettings + git-init setup used in the env-var
  // mapping tests above - `activate` needs a real-looking Unity project
  // dir, and vcsDetection shells out to git and throws if it isn't a repo.
  async function makeProjectDir() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "game-ci-cli-profiles-"));
    await fs.mkdir(path.join(tempDir, "ProjectSettings"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "ProjectSettings", "ProjectVersion.txt"),
      "m_EditorVersion: 2022.3.20f1\n",
      "utf8",
    );
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["init", tempDir]);
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`git init exited with ${code}`))));
    });

    return tempDir;
  }

  async function parseOptions(tempDir: string, configPath: string, extraArgs: string[] = []) {
    const cli = new Cli(["activate", tempDir, "--config", configPath, ...extraArgs], process.cwd());
    await cli.setup();
    await cli.registerCommands();
    await cli.registerSchemaForChosenCommand();
    const { options } = await cli.validateAndParseArguments();

    return options;
  }

  it("applies the selected profile on top of base cliOptions (YAML)", async () => {
    const tempDir = await makeProjectDir();
    try {
      const configPath = path.join(tempDir, ".game-ci.yml");
      await fs.writeFile(
        configPath,
        `cliOptions:
  verbose: false

profiles:
  loud:
    verbose: true
`,
        "utf8",
      );

      const options = await parseOptions(tempDir, configPath, ["--profile", "loud"]);

      expect(options.logLevel).toBe(1); // verbose: true from the profile
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("applies the selected profile on top of base cliOptions (JSON)", async () => {
    const tempDir = await makeProjectDir();
    try {
      const configPath = path.join(tempDir, ".game-ci.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({
          cliOptions: { verbose: false },
          profiles: { loud: { verbose: true } },
        }),
        "utf8",
      );

      const options = await parseOptions(tempDir, configPath, ["--profile", "loud"]);

      expect(options.logLevel).toBe(1); // verbose: true from the profile
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("profile options win over base cliOptions on key conflicts", async () => {
    const tempDir = await makeProjectDir();
    try {
      const configPath = path.join(tempDir, ".game-ci.yml");
      await fs.writeFile(
        configPath,
        `cliOptions:
  verbose: true

profiles:
  quiet-profile:
    verbose: false
`,
        "utf8",
      );

      const withoutProfile = await parseOptions(tempDir, configPath);
      expect(withoutProfile.logLevel).toBe(1); // base cliOptions.verbose: true

      const withProfile = await parseOptions(tempDir, configPath, ["--profile", "quiet-profile"]);
      expect(withProfile.logLevel).toBe(0); // profile's verbose: false wins over base
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("explicit CLI flags still win over the selected profile", async () => {
    const tempDir = await makeProjectDir();
    try {
      const configPath = path.join(tempDir, ".game-ci.yml");
      await fs.writeFile(
        configPath,
        `cliOptions:
  verbose: false

profiles:
  loud:
    verbose: true
`,
        "utf8",
      );

      // --profile loud sets verbose: true, but the explicit --verbose=false
      // flag on the command line must win over both the profile and base cliOptions.
      const options = await parseOptions(tempDir, configPath, ["--profile", "loud", "--verbose=false"]);

      expect(options.logLevel).toBe(0);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails with a clear, actionable error listing available profiles for an unknown --profile name", async () => {
    const tempDir = await makeProjectDir();
    try {
      const configPath = path.join(tempDir, ".game-ci.yml");
      await fs.writeFile(
        configPath,
        `cliOptions:
  verbose: false

profiles:
  webgl-demo:
    verbose: true
  windows-release:
    verbose: true
`,
        "utf8",
      );

      await expect(parseOptions(tempDir, configPath, ["--profile", "does-not-exist"])).rejects.toThrow(
        /Unknown profile "does-not-exist".*webgl-demo.*windows-release/s,
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("is a zero behavior change when no --profile flag is passed (regression check)", async () => {
    const tempDir = await makeProjectDir();
    try {
      const configPath = path.join(tempDir, ".game-ci.yml");
      await fs.writeFile(
        configPath,
        `cliOptions:
  verbose: true

profiles:
  loud:
    verbose: false
`,
        "utf8",
      );

      const options = await parseOptions(tempDir, configPath);

      // Only base cliOptions applies - the profiles: block is ignored entirely.
      expect(options.logLevel).toBe(1);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("is a zero behavior change for configs that have no profiles: block at all", async () => {
    const tempDir = await makeProjectDir();
    try {
      const configPath = path.join(tempDir, ".game-ci.yml");
      await fs.writeFile(
        configPath,
        `cliOptions:
  verbose: true
`,
        "utf8",
      );

      const options = await parseOptions(tempDir, configPath);

      expect(options.logLevel).toBe(1);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
