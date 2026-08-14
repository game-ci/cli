import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'node:process';
import { spawn } from 'node:child_process';
import { Cli } from './cli.ts';
import { UnityOrchestrateCommand } from './command/orchestrate/unity-orchestrate-command.ts';
import { CommandFactory } from './command/command-factory.ts';
import { unityPlugin } from './plugin/builtin/unity-plugin.ts';
import { PluginRegistry } from './plugin/plugin-registry.ts';

describe('Cli plugin loading', () => {
  beforeEach(() => {
    PluginRegistry.reset();
  });

  afterEach(() => {
    PluginRegistry.reset();
  });

  it('loads executable plugins from the --plugin flag during setup', async () => {
    const cli = new Cli(['--plugin', `executable:${process.execPath}`], process.cwd());

    await cli.setup();

    expect(PluginRegistry.getAvailableProviders()).toContain('cli-protocol');
    expect(PluginRegistry.getRegisteredPlugins().some((plugin) => plugin.name.startsWith('executable:'))).toBe(true);
  });

  it('loads executable plugins from config during setup', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-ci-cli-'));
    try {
      await fs.writeFile(
        path.join(tempDir, '.game-ci.yml'),
        `cliOptions:
  plugins:
    - executable:${process.execPath}
`,
        'utf8',
      );

      const cli = new Cli([], tempDir);

      await cli.setup();

      expect(PluginRegistry.getAvailableProviders()).toContain('cli-protocol');
      expect(PluginRegistry.getRegisteredPlugins().some((plugin) => plugin.name.startsWith('executable:'))).toBe(true);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not register built-in plugins more than once', async () => {
    const cli = new Cli([], process.cwd());

    await cli.setup();
    await cli.setup();

    const pluginNames = PluginRegistry.getRegisteredPlugins().map((plugin) => plugin.name);
    expect(pluginNames.filter((name) => name === 'unity')).toHaveLength(1);
    expect(pluginNames.filter((name) => name === 'godot')).toHaveLength(1);
    expect(pluginNames.filter((name) => name === 'unreal')).toHaveLength(1);
  });

  it('supports orchestrate as the preferred provider-backed command', async () => {
    await PluginRegistry.register(unityPlugin);

    const command = new CommandFactory().selectEngine('unity', '2022.3.20f1').createCommand(['orchestrate']);

    expect(command).toBeInstanceOf(UnityOrchestrateCommand);
  });

  it('keeps remote run as a backwards-compatible alias', async () => {
    await PluginRegistry.register(unityPlugin);

    const command = new CommandFactory().selectEngine('unity', '2022.3.20f1').createCommand(['remote', 'run']);

    expect(command).toBeInstanceOf(UnityOrchestrateCommand);
  });

  it('keeps remote build as a backwards-compatible alias', async () => {
    await PluginRegistry.register(unityPlugin);

    const command = new CommandFactory().selectEngine('unity', '2022.3.20f1').createCommand(['remote', 'build']);

    expect(command).toBeInstanceOf(UnityOrchestrateCommand);
  });
});

describe('Cli env var option mapping', () => {
  // Secrets (Unity credentials, license contents) must reach the CLI via
  // environment variables, not argv - argv can leak through process
  // listings and gets echoed by exec loggers. UnityOptions defaults each
  // credential option to its matching UNITY_* env var (see
  // unity-options.ts) rather than using yargs' blanket .env(), which
  // combined with strict(true) rejects every unrelated process env var as
  // an unrecognized argument.
  it('populates unityEmail from the UNITY_EMAIL env var', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-ci-cli-'));
    try {
      await fs.mkdir(path.join(tempDir, 'ProjectSettings'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'ProjectSettings', 'ProjectVersion.txt'), 'm_EditorVersion: 2022.3.20f1\n', 'utf8');
      // vcsDetection shells out to git and throws if the project path isn't a repo.
      await new Promise((resolve, reject) => {
        const child = spawn('git', ['init', tempDir]);
        child.on('error', reject);
        child.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`git init exited with ${code}`))));
      });

      const previousEmail = process.env.UNITY_EMAIL;
      process.env.UNITY_EMAIL = 'bot@game.ci';
      try {
        const cli = new Cli(['activate', tempDir], process.cwd());
        await cli.setup();
        await cli.registerCommands();
        await cli.registerSchemaForChosenCommand();
        const { options } = await cli.validateAndParseArguments();

        expect(options.unityEmail).toBe('bot@game.ci');
      } finally {
        if (previousEmail === undefined) delete process.env.UNITY_EMAIL;
        else process.env.UNITY_EMAIL = previousEmail;
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
