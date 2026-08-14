/**
 * Bridge file — stub for Cli.
 *
 * In unity-builder the Cli class manages CLI mode detection and option
 * querying via commander.  The orchestrator reads Cli.isCliMode, Cli.options,
 * and Cli.query() to switch behaviour between GitHub Actions and CLI mode.
 */

import { OptionValues } from 'commander';

class Cli {
  static options: OptionValues | undefined;

  static get isCliMode(): boolean {
    return Cli.options !== undefined && Cli.options.mode !== undefined && Cli.options.mode !== '';
  }

  static query(key: string, alternativeKey: string): any {
    if (!Cli.options) return undefined;

    return Cli.options[key] ?? Cli.options[alternativeKey] ?? undefined;
  }

  static InitCliMode(): boolean {
    return Cli.isCliMode;
  }

  static async RunCli(): Promise<void> {
    // stub — the host provides the real CLI runner
  }
}

export { Cli };
export default Cli;
