import { fileFormatter, consoleFormatter } from './formatter.ts';
import { getHomeDir, fsSync as fs } from '../../dependencies.ts';
import * as nodePath from 'node:path';
import * as nodeFs from 'node:fs';

export enum Verbosity {
  quiet = -1,
  normal = 0,
  verbose = 1,
  veryVerbose = 2,
  maxVerbose = 3,
}

export const configureLogger = async (verbosity: Verbosity) => {
  // Verbosity
  const isQuiet = verbosity === Verbosity.quiet;
  const isVerbose = verbosity >= Verbosity.verbose;
  const isVeryVerbose = verbosity >= Verbosity.veryVerbose;
  const isMaxVerbose = verbosity >= Verbosity.maxVerbose;

  // Config folder
  const configFolder = `${getHomeDir()}/.game-ci`;
  fs.ensureDir(configFolder);

  const logFilePath = nodePath.join(configFolder, 'game-ci.log');

  // Create a simple logger that writes to console and file
  const writeToFile = (level: string, msg: string) => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const line = `${timestamp} [${level}] ${msg}\n`;
    try {
      nodeFs.appendFileSync(logFilePath, line);
    } catch {
      // Silently fail file writes
    }
  };

  const formatArgs = (msg: any, args: any[]): string => {
    const parts = [typeof msg === 'string' ? msg : inspect(msg)];
    for (const arg of args) {
      parts.push(typeof arg === 'string' ? arg : inspect(arg));
    }
    return parts.join(' ');
  };

  const inspect = (value: any): string => {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    // Error's message/stack/name are non-enumerable own properties, so
    // JSON.stringify(error) below silently produces '{}' for any bare Error
    // - masking every uncaught failure's actual message. Must be handled
    // before the JSON.stringify fallback, not caught by it.
    if (value instanceof Error) {
      return value.stack || `${value.name}: ${value.message}`;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  // Exit on SIGINT (log writes above are synchronous, so nothing to flush).
  // 130 (128 + SIGINT's signal number) is the POSIX convention — this was
  // previously exiting 0, making a user-cancelled run indistinguishable from
  // success to any script checking $?.
  process.on('SIGINT', () => process.exit(130));

  const logger = {
    verbosity,
    verbosityName: Verbosity[verbosity],
    isQuiet,
    isVerbose,
    isVeryVerbose,
    isMaxVerbose,

    debug: (msg: any, ...args: any[]) => {
      const formatted = formatArgs(msg, args);
      writeToFile('DEBUG', formatted);
      if (isVerbose && !isQuiet) console.debug(`[DEBUG] ${formatted}`);
    },

    info: (msg: any, ...args: any[]) => {
      const formatted = formatArgs(msg, args);
      writeToFile('INFO', formatted);
      if (!isQuiet) console.log(`[INFO] ${formatted}`);
    },

    warning: (msg: any, ...args: any[]) => {
      const formatted = formatArgs(msg, args);
      writeToFile('WARNING', formatted);
      if (!isQuiet) console.warn(`[WARN] ${formatted}`);
    },

    error: (msg: any, ...args: any[]) => {
      const formatted = formatArgs(msg, args);
      writeToFile('ERROR', formatted);
      console.error(`[ERROR] ${formatted}`);
    },

    // GitHub Actions log line grouping (::group::/::endgroup::) — collapses
    // a section of output into a foldable block in the Actions UI instead of
    // one long unbroken stream. No-op outside GitHub Actions (GITHUB_ACTIONS
    // unset), since ::group:: markers would just show up as literal text in
    // a plain terminal or local log file.
    startGroup: (name: string) => {
      writeToFile('GROUP', name);
      if (process.env.GITHUB_ACTIONS === 'true' && !isQuiet) {
        console.log(`::group::${name}`);
      } else if (!isQuiet) {
        console.log(`--- ${name} ---`);
      }
    },

    endGroup: () => {
      if (process.env.GITHUB_ACTIONS === 'true' && !isQuiet) {
        console.log('::endgroup::');
      }
    },

    // Convenience wrapper: runs fn() inside a named group, closing the group
    // even if fn() throws.
    group: async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
      logger.startGroup(name);
      try {
        return await fn();
      } finally {
        logger.endGroup();
      }
    },
  };

  (globalThis as any).log = logger;
};
