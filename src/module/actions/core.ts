/* eslint-disable no-console */

import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { EOL } from 'node:os';

// Adapted from: https://github.com/actions/toolkit/blob/9b7bcb1567c9b7f134eb3c2d6bbf409a5106a956/packages/core/src/core.ts#L13
/**
 * Interface for getInput options
 */
export interface InputOptions {
  /** Optional. Whether the input is required. If required and not present, will throw. Defaults to false */
  required?: boolean;

  /** Optional. Whether leading/trailing whitespace will be trimmed for the input. Defaults to true */
  trimWhitespace?: boolean;
}

export const core = {
  info: console.log,

  warning: console.warn,

  error: (error: Error) => {
    console.error(error, error.stack);
  },

  setOutput: (key: string, value: string) => {
    // Same split as the real @actions/core: write the file GitHub hands us,
    // and only fall back to stdout when there isn't one. Printing was
    // previously the only branch, so this never reached $GITHUB_OUTPUT at all
    // - which silently dropped the buildVersion/androidVersionCode that
    // `game-ci build` publishes for unity-builder to consume.
    const filePath = process.env['GITHUB_OUTPUT'];
    if (filePath) {
      // The delimiter form, not `key=value`: the value is user-supplied (a
      // version string), and `key=value` cannot carry a newline.
      const delimiter = `ghadelimiter_${randomUUID()}`;
      appendFileSync(filePath, `${key}<<${delimiter}${EOL}${value}${EOL}${delimiter}${EOL}`);
      return;
    }

    console.log(`(mock) Output "${key}" is set to "${value}"`);
  },

  // Adapted from: https://github.com/actions/toolkit/blob/9b7bcb1567c9b7f134eb3c2d6bbf409a5106a956/packages/core/src/core.ts#L128
  getInput: (name: string, options: InputOptions = {required: false, trimWhitespace: true}) => {
    const variable = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
    const value: string = process.env[variable] || '';

    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }

    if (options?.trimWhitespace === false) {
      return value;
    }

    return value.trim();
  },
};
