// npm packages (replaces Deno URL imports)
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

import * as semver from 'semver';
import * as yaml from 'yaml';
import { nanoid, customAlphabet } from 'nanoid';
import { config, configDotenv } from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Re-export nanoid with compatible API
const nanoidCompat = { nanoid, customAlphabet };

// Type imports from yargs
import type { Argv as YargsInstanceType, Arguments as YargsArgs } from 'yargs';
type YargsInstance = YargsInstanceType;

// Platform EOL
const platformEOL = process.platform === 'win32' ? '\r\n' : '\n';

// Internally managed packages
import waitUntil from './module/wait-until.ts';
import { core } from './module/actions/index.ts';
import { dedent } from './module/dedent.ts';

import './global.d.ts';

// Polyfill for https://github.com/tc39/proposal-string-dedent
String.dedent = dedent;

// Errors from yargs can be very verbose and not very descriptive
Error.stackTraceLimit = 15;

class Writable {
  constructor() {
    throw new Error('Writable is not implemented'); // stream
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// base64 compat (replaces Deno std base64)
const base64 = {
  encode: (data: Uint8Array): string => Buffer.from(data).toString('base64'),
  decode: (str: string): Uint8Array => new Uint8Array(Buffer.from(str, 'base64')),
};

// assert compat
const assert = {
  assertEquals: (actual: unknown, expected: unknown, msg?: string) => {
    if (actual !== expected) throw new Error(msg || `Expected ${expected} but got ${actual}`);
  },
  assertThrows: (fn: () => void, msg?: string) => {
    try { fn(); throw new Error(msg || 'Expected function to throw'); } catch { /* expected */ }
  },
};

// fsSync compat (adds ensureDir, existsSync, EOL)
const fsSyncCompat = {
  ...fsSync,
  existsSync: fsSync.existsSync,
  ensureDir: (dir: string) => { fsSync.mkdirSync(dir, { recursive: true }); },
  ensureDirSync: (dir: string) => { fsSync.mkdirSync(dir, { recursive: true }); },
  EOL: { LF: '\n' as const, CRLF: '\r\n' as const },
};

// getHomeDir compat
const getHomeDir = (): string | null => {
  return process.env.HOME || process.env.USERPROFILE || null;
};

// These explicit type definitions are needed for auto-import to work
type YargsArguments = YargsArgs;
type Options = YargsArguments; // Use when you want to abstract away from the CLI logic

// Logging formatter types (previously from Deno std/log)
type LogRecord = {
  level: number;
  levelName: string;
  msg: string;
  args: unknown[];
  loggerName: string;
};

type FormatterFunction = (record: LogRecord) => string;

export type { YargsArguments, Options, FormatterFunction, LogRecord };
export {
  __dirname,
  __filename,
  assert,
  base64,
  Buffer,
  config,
  core,
  crypto,
  dedent,
  fs,
  fsSyncCompat as fsSync,
  getHomeDir,
  http,
  nanoidCompat as nanoid,
  path,
  platformEOL,
  process,
  semver,
  waitUntil,
  Writable,
  yaml,
  yargs,
  hideBin,
};
export type { YargsInstance };
