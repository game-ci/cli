import type { Options } from '../../dependencies.ts';
import { EngineDetector } from './engine-detector.ts';

export const engineDetection = async (argv: Options) => {
  let { projectPath } = argv;

  if (!projectPath) projectPath = process.cwd();

  const { engine, engineVersion } = new EngineDetector(projectPath).detect();

  argv.engine = engine;
  argv.engineVersion = engineVersion;
};
