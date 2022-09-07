import { path, __dirname, __filename } from '../dependencies.ts';

class Action {
  static get isRunningLocally() {
    return Deno.env.get('RUNNER_WORKSPACE') === undefined;
  }

  static get isRunningFromSource() {
    return path.basename(__dirname) === 'model';
  }

  static get canonicalName() {
    return 'unity-builder';
  }

  static get rootFolder() {
    if (Action.isRunningFromSource) {
      return path.dirname(path.dirname(path.dirname(__filename)));
    }

    return path.dirname(path.dirname(__filename));
  }

  static get actionFolder() {
    return `${Action.rootFolder}/dist`;
  }

  static get workspace() {
    if (Action.isRunningLocally) return Deno.cwd();

    return Deno.env.get('GITHUB_WORKSPACE');
  }
}

export default Action;
