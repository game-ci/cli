import { Options } from "../../dependencies.ts";
import { EngineDetector } from './engine-detector.ts';

export const engineDetection = async (argv: Options) => {
  let { projectPath } = argv;

  if (!projectPath) projectPath = Deno.cwd();

  const { engine, engineVersion } = await new EngineDetector(projectPath).detect();

  argv.engine = engine;
  argv.engineVersion = engineVersion;
};
