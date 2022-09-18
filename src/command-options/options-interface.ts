import { YargsInstance } from '../dependencies.ts';

export class IOptions {
  static configure: (yargs: YargsInstance) => Promise<void> | void;
}
