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
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  // Flush file on SIGINT
  process.on('SIGINT', () => process.exit(0));

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
  };

  (globalThis as any).log = logger;
};
