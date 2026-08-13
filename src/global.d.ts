import { Verbosity } from './core/logger/index.ts';

declare global {
  interface StringConstructor {
    dedent(template: TemplateStringsArray | string, ...values: unknown[]): string;
  }

  interface ErrorConstructor {
    stackTraceLimit: number;
  }

  let log: {
    verbosity: Verbosity;
    isQuiet: boolean;
    isVerbose: boolean;
    isVeryVerbose: boolean;
    isMaxVerbose: boolean;
    debug: (msg: any, ...args: any[]) => void;
    info: (msg: any, ...args: any[]) => void;
    warning: (msg: any, ...args: any[]) => void;
    error: (msg: any, ...args: any[]) => void;
    startGroup: (name: string) => void;
    endGroup: () => void;
    group: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;
  };

  var process: typeof import('node:process');
}

declare interface StringConstructor {
  dedent(template: TemplateStringsArray | string, ...values: unknown[]): string;
}

declare interface ErrorConstructor {
  stackTraceLimit: number;
}
