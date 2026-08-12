/**
 * EXPERIMENTAL, unwired spike for game-ci/roadmap#11 workstream 3.
 *
 * Shells out to Unity Technologies' own official "Unity CLI" binary
 * (docs.unity.com/en-us/unity-cli — itself still marked experimental), as an
 * alternative install/build mechanism to game-ci's current unity-hub-driven
 * flows. Not called from anywhere yet — no command wires this up, no plugin
 * references it. Exists to validate the subprocess-shell-out shape before
 * committing to it as the integration mechanism (see the "not yet decided"
 * options in game-ci/roadmap#11: subprocess vs. library vs. only borrowing
 * conventions).
 *
 * Per the guiding principle from that issue — users should get the full
 * benefit from GameCI's own docs, not need to separately learn Unity CLI's
 * syntax — nothing here should ever be the *only* way to do something; it's
 * an alternative backend for existing game-ci commands to optionally use,
 * not a new surface for users to learn directly.
 */

import { System } from './system/system.ts';

export interface UnityCliInstallResult {
  success: boolean;
  output: string;
}

export class UnityCliAdapter {
  /** Checks whether the `unity` CLI binary is available on PATH. */
  static async isAvailable(): Promise<boolean> {
    try {
      const result = await System.run('unity --version', undefined, { silent: true });
      return result.status?.success ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Install a Unity Editor version, optionally with modules, via Unity CLI's
   * `install` command — a Hub-free alternative to `unity-hub install`.
   * Matches Unity CLI's documented syntax: `unity install <version> -m <module> [-m <module>...]`.
   *
   * Note: System.run() throws on any stderr output or non-zero exit code
   * rather than returning a checkable failure — callers should catch, not
   * check `.success` on a rejected promise.
   */
  static async installEditor(
    version: string,
    modules: string[] = [],
  ): Promise<UnityCliInstallResult> {
    const moduleArgs = modules.flatMap((m) => ['-m', m]);
    const command = ['unity', 'install', version, ...moduleArgs].join(' ');
    const result = await System.run(command, undefined, { silent: true });

    return { success: result.status?.success ?? false, output: result.output };
  }

  /**
   * Add modules to an already-installed Editor version via Unity CLI's
   * `install-modules` command. Matches documented syntax:
   * `unity install-modules -e <version> -m <module> [-m <module>...]`.
   */
  static async installModules(
    editorVersion: string,
    modules: string[],
  ): Promise<UnityCliInstallResult> {
    const moduleArgs = modules.flatMap((m) => ['-m', m]);
    const command = ['unity', 'install-modules', '-e', editorVersion, ...moduleArgs].join(' ');
    const result = await System.run(command, undefined, { silent: true });

    return { success: result.status?.success ?? false, output: result.output };
  }

  // `build`/`test`/`license` are intentionally NOT stubbed here yet — Unity's
  // own CLI reference doesn't publish their full flag sets beyond one-line
  // descriptions ("CI-friendly flags, including Android signing and export
  // options" for `build`), so wiring them accurately needs testing against
  // the real binary rather than guessing at flags from docs alone. See
  // game-ci/roadmap#11 workstream 3 for the compatibility-check this needs
  // before those methods can be added responsibly.
}
