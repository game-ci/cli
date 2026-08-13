import type { YargsInstance, YargsArguments } from '../dependencies.ts';

export interface CommandInterface {
  name: string;
  /**
   * Returns `true` on success, `false` on a handled (non-throwing) failure.
   * Throw instead of returning `false` for unexpected/unrecoverable errors —
   * the top-level handler treats a thrown error and a `false` return the same
   * way (non-zero exit), but throwing preserves the stack trace.
   */
  execute: (options: YargsArguments) => Promise<boolean>;
  configureOptions: (instance: YargsInstance) => Promise<void>;
}
