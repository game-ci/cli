import type { Options } from '../../dependencies.ts';
import { EngineDetector } from './engine-detector.ts';

export const engineDetection = async (argv: Options) => {
  let { projectPath } = argv;

  if (!projectPath) projectPath = process.cwd();

  // Respect an explicit --engine/--engineVersion instead of clobbering it:
  // both are already registered options (see project-options.ts,
  // default ''), so a caller that knows better than ProjectVersion.txt -
  // e.g. unity-builder's "via Build Profile" test matrix cell, which needs
  // Unity 6 even though its checked-out test-project's ProjectVersion.txt
  // says 2021.3.45f1 - can override auto-detection. See game-ci/cli#154.
  const needsEngine = !argv.engine;
  const needsEngineVersion = !argv.engineVersion;
  if (!needsEngine && !needsEngineVersion) return;

  const detected = new EngineDetector(projectPath).detect();

  if (needsEngine) argv.engine = detected.engine;
  if (needsEngineVersion) argv.engineVersion = detected.engineVersion;
};
