// Test preload: set up global `log` and `String.dedent` so source files that
// reference them don't throw ReferenceError during tests.
import { dedent } from './module/dedent.ts';

String.dedent = dedent;

const noop = () => {};

(globalThis as any).log = {
  verbosity: 0,
  isQuiet: false,
  isVerbose: false,
  isVeryVerbose: false,
  isMaxVerbose: false,
  debug: noop,
  info: noop,
  warning: noop,
  error: noop,
};
