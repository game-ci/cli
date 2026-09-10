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
import { Docker } from "./model/docker.ts";

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

  it("loads runtime-test-framework through PluginLoader and resolves `test-runtime` without engine detection", async () => {
    const cli = new Cli([], process.cwd());

    await cli.setup();

    expect(PluginRegistry.getRegisteredPlugins().some((plugin) => plugin.name === "runtime-test-framework")).toBe(true);

    const command = new CommandFactory().createCommand(["test-runtime"]);
    expect(command.name).toBe("Test runtime");
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
  // Mirrors the ProjectSettings + git-init setup the profile tests use -
  // `activate` needs a real-looking Unity project dir, and vcsDetection
  // shells out to git and throws if it isn't a repo.
  async function makeProjectDir() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "game-ci-cli-env-"));
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

  // Sets env vars for the duration of one parse and restores them after,
  // including vars that were previously unset (deleted, not set to "").
  async function withEnv(vars: Record<string, string>, run: () => Promise<any>) {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(vars)) {
      previous.set(key, process.env[key]);
      process.env[key] = value;
    }
    try {
      return await run();
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  async function parseOptions(tempDir: string, extraArgs: string[] = []) {
    const cli = new Cli(["activate", tempDir, ...extraArgs], process.cwd());
    await cli.setup();
    await cli.registerCommands();
    await cli.registerSchemaForChosenCommand();
    const { options } = await cli.validateAndParseArguments();

    return options;
  }

  // Secrets (Unity credentials, license contents) must reach the CLI via
  // environment variables, not argv - argv can leak through process
  // listings and gets echoed by exec loggers. UnityOptions defaults each
  // credential option to its matching UNITY_* env var (see
  // unity-options.ts). These unprefixed names are long-standing public
  // contract and are unaffected by the GAME_CI_* prefix mapping below.
  it("populates unityEmail from the UNITY_EMAIL env var", async () => {
    const tempDir = await makeProjectDir();
    try {
      const options = await withEnv({ UNITY_EMAIL: "bot@game.ci" }, () => parseOptions(tempDir));

      expect(options.unityEmail).toBe("bot@game.ci");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // The thin wrappers (unity-builder, unity-test-runner, unity-activate)
  // spawn this CLI as a host child process that inherits the workflow
  // environment, so GAME_CI_* is how a workflow reaches an option the
  // wrapper's action.yml has no input for - no wrapper release required.
  it("maps GAME_CI_<SCREAMING_SNAKE_CASE> onto the matching option", async () => {
    const tempDir = await makeProjectDir();
    try {
      const options = await withEnv({ GAME_CI_ENGINE_VERSION: "6000.0.36f1" }, () => parseOptions(tempDir));

      expect(options.engineVersion).toBe("6000.0.36f1");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Precedence has to be arg > env > default, so a wrapper that already
  // passes an explicit flag keeps winning and GAME_CI_* only fills in what
  // the wrapper left unset.
  it("lets an explicit argument win over the GAME_CI_* env var", async () => {
    const tempDir = await makeProjectDir();
    try {
      const options = await withEnv({ GAME_CI_ENGINE_VERSION: "6000.0.36f1" }, () =>
        parseOptions(tempDir, ["--engineVersion", "2022.3.20f1"]),
      );

      expect(options.engineVersion).toBe("2022.3.20f1");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // The whole reason a blanket .env() was previously avoided: under
  // strict(true) it maps every process env var to an option name and then
  // rejects the invocation wholesale. The prefix confines the mapping, so
  // unrelated vars - including ones that would camelize into a real option
  // name if the prefix were dropped - must be ignored entirely.
  it("ignores env vars that do not carry the GAME_CI_ prefix", async () => {
    const tempDir = await makeProjectDir();
    try {
      const options = await withEnv(
        { SOME_UNRELATED_VARIABLE: "should be ignored", ENGINE_VERSION: "1234.5.6f7" },
        () => parseOptions(tempDir),
      );

      expect(options.engineVersion).not.toBe("1234.5.6f7");
      expect(options).not.toHaveProperty("someUnrelatedVariable");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // Documents the deliberate tradeoff of reserving the namespace: a
  // GAME_CI_* var matching no option is a hard failure rather than being
  // silently dropped, so typos surface immediately instead of leaving the
  // user wondering why their setting had no effect. Asserted out-of-process
  // because strict-mode failures route through Cli.handleFailure, which
  // process.exit(1)s - in-process it would take the test runner down with it.
  it("rejects a GAME_CI_* var that matches no known option", async () => {
    const tempDir = await makeProjectDir();
    try {
      const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ["run", path.join(process.cwd(), "src", "index.ts"), "activate", tempDir], {
          env: { ...process.env, GAME_CI_NOT_A_REAL_OPTION: "x" },
        });
        let stderr = "";
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.on("error", reject);
        child.on("exit", (code) => resolve({ code, stderr }));
      });

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("notARealOption");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }, 60_000);
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

// Regression tests for the Discord-reported bug: a Windows host running
// Docker Desktop in Linux-containers mode got the windows-tagged image and a
// `c:`-prefixed workdir, because hostOS was derived purely from
// process.platform instead of asking the Docker daemon what it's actually
// running.
describe("Cli container OS resolution", () => {
  const originalDetectDaemonOs = Docker.detectDaemonOs;

  afterEach(() => {
    Docker.detectDaemonOs = originalDetectDaemonOs;
  });

  it("honors an explicit --container-os override without touching Docker", async () => {
    let called = false;
    Docker.detectDaemonOs = async () => {
      called = true;
      return "windows";
    };

    const cli = new Cli(["--container-os", "linux"], process.cwd());
    const hostOS = await (cli as unknown as { resolveHostOS(): Promise<string> }).resolveHostOS();

    expect(hostOS).toBe("linux");
    expect(called).toBe(false);
  });

  it("also accepts --container-os=value form", async () => {
    Docker.detectDaemonOs = async () => "linux";

    const cli = new Cli(["--container-os=windows"], process.cwd());
    const hostOS = await (cli as unknown as { resolveHostOS(): Promise<string> }).resolveHostOS();

    expect(hostOS).toBe("windows");
  });

  it("on a non-Windows host, trusts the existing hostOS without querying Docker", async () => {
    let called = false;
    Docker.detectDaemonOs = async () => {
      called = true;
      return "windows";
    };

    const cli = new Cli([], process.cwd());
    const hostOS = await (cli as unknown as { resolveHostOS(): Promise<string> }).resolveHostOS();

    // hostPlatform on the test runner determines this; only assert Docker
    // wasn't consulted when the host isn't win32.
    if (process.platform !== "win32") {
      expect(called).toBe(false);
      expect(hostOS).toBe(process.platform);
    }
  });
});
