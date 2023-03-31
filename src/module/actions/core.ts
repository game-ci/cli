/* eslint-disable no-console */

// Adapted from: https://github.com/actions/toolkit/blob/9b7bcb1567c9b7f134eb3c2d6bbf409a5106a956/packages/core/src/core.ts#L13
/**
 * Interface for getInput options
 */
export interface InputOptions {
  /** Optional. Whether the input is required. If required and not present, will throw. Defaults to false */
  required?: boolean

  /** Optional. Whether leading/trailing whitespace will be trimmed for the input. Defaults to true */
  trimWhitespace?: boolean
}

export const core = {
  info: console.log,

  warning: console.warn,

  error: (error: Error) => {
    console.error(error, error.stack);
  },

  setOutput: (key: string, value: string) => {
    console.log(`(mock) Output "${key}" is set to "${value}"`);
  },

  // Adapted from: https://github.com/actions/toolkit/blob/9b7bcb1567c9b7f134eb3c2d6bbf409a5106a956/packages/core/src/core.ts#L128
  getInput: (name: string, options: InputOptions) => {
    const variable = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
    const value: string = Deno.env.get(variable) || '';

    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }

    if (options?.trimWhitespace === false) {
      return value;
    }

    return value.trim();
  },
};
