import { fsSync as fs, yaml } from '../../dependencies.ts';

/**
 * Fields a recipe file can declare — mirrors build-unity-image's CLI flags
 * 1:1, per docs/proposals/recipe-file-format.md. All fields are optional
 * except unityVersion; anything the recipe doesn't set falls through to the
 * command's normal flag/default resolution.
 */
export interface RecipeFile {
  version?: number;
  engine?: string;
  unityVersion: string;
  baseOs?: string;
  modules?: string[];
  changeset?: string;
  hubImage?: string;
  baseImage?: string;
  tag?: string;
}

export class RecipeFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeFileError';
  }
}

const RecipeFileReader = {
  read(recipePath: string): RecipeFile {
    if (!fs.existsSync(recipePath)) {
      throw new RecipeFileError(`Recipe file not found: ${recipePath}`);
    }

    let parsed: unknown;
    try {
      parsed = yaml.parse(fs.readFileSync(recipePath, 'utf8'));
    } catch (error: any) {
      throw new RecipeFileError(`Could not parse recipe file "${recipePath}": ${error.message}`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new RecipeFileError(`Recipe file "${recipePath}" must contain a YAML mapping.`);
    }

    const recipe = parsed as Record<string, unknown>;

    if (recipe.engine !== undefined && recipe.engine !== 'unity') {
      throw new RecipeFileError(
        `Recipe file "${recipePath}" declares engine "${recipe.engine}", but build-unity-image only supports "unity".`,
      );
    }

    if (typeof recipe.unityVersion !== 'string' || recipe.unityVersion === '') {
      throw new RecipeFileError(`Recipe file "${recipePath}" is missing required field "unityVersion".`);
    }

    if (recipe.modules !== undefined && !Array.isArray(recipe.modules)) {
      throw new RecipeFileError(`Recipe file "${recipePath}": "modules" must be a list.`);
    }

    return {
      version: typeof recipe.version === 'number' ? recipe.version : undefined,
      engine: typeof recipe.engine === 'string' ? recipe.engine : undefined,
      unityVersion: recipe.unityVersion,
      baseOs: typeof recipe.baseOs === 'string' ? recipe.baseOs : undefined,
      modules: Array.isArray(recipe.modules) ? recipe.modules.map(String) : undefined,
      changeset: typeof recipe.changeset === 'string' ? recipe.changeset : undefined,
      hubImage: typeof recipe.hubImage === 'string' ? recipe.hubImage : undefined,
      baseImage: typeof recipe.baseImage === 'string' ? recipe.baseImage : undefined,
      tag: typeof recipe.tag === 'string' ? recipe.tag : undefined,
    };
  },
};

export { RecipeFileReader };
