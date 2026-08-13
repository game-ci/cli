import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RecipeFileError, RecipeFileReader } from './recipe-file.ts';

const tempFiles: string[] = [];

function writeTempRecipe(contents: string): string {
  const filePath = path.join(os.tmpdir(), `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}.yml`);
  fs.writeFileSync(filePath, contents);
  tempFiles.push(filePath);
  return filePath;
}

afterEach(() => {
  while (tempFiles.length > 0) {
    const filePath = tempFiles.pop()!;
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
});

describe('RecipeFileReader', () => {
  it('throws when the file does not exist', () => {
    expect(() => RecipeFileReader.read('/does/not/exist.yml')).toThrow(RecipeFileError);
  });

  it('parses a minimal recipe with just unityVersion', () => {
    const filePath = writeTempRecipe('unityVersion: 2022.3.20f1\n');
    const recipe = RecipeFileReader.read(filePath);

    expect(recipe.unityVersion).toBe('2022.3.20f1');
    expect(recipe.baseOs).toBeUndefined();
    expect(recipe.modules).toBeUndefined();
  });

  it('parses the full strawman schema', () => {
    const filePath = writeTempRecipe(`
version: 1
engine: unity
unityVersion: 2022.3.20f1
baseOs: ubuntu
modules:
  - android
  - webgl
changeset: abcdef123456
hubImage: unityci/hub
baseImage: unityci/base
tag: my-custom-tag
`);
    const recipe = RecipeFileReader.read(filePath);

    expect(recipe).toEqual({
      version: 1,
      engine: 'unity',
      unityVersion: '2022.3.20f1',
      baseOs: 'ubuntu',
      modules: ['android', 'webgl'],
      changeset: 'abcdef123456',
      hubImage: 'unityci/hub',
      baseImage: 'unityci/base',
      tag: 'my-custom-tag',
    });
  });

  it('throws when unityVersion is missing', () => {
    const filePath = writeTempRecipe('baseOs: ubuntu\n');
    expect(() => RecipeFileReader.read(filePath)).toThrow(/unityVersion/);
  });

  it('throws when engine is not "unity"', () => {
    const filePath = writeTempRecipe('unityVersion: 2022.3.20f1\nengine: godot\n');
    expect(() => RecipeFileReader.read(filePath)).toThrow(/engine/);
  });

  it('throws when modules is not a list', () => {
    const filePath = writeTempRecipe('unityVersion: 2022.3.20f1\nmodules: android\n');
    expect(() => RecipeFileReader.read(filePath)).toThrow(/modules/);
  });

  it('throws when the YAML does not parse to a mapping', () => {
    const filePath = writeTempRecipe('- just\n- a\n- list\n');
    expect(() => RecipeFileReader.read(filePath)).toThrow(/mapping/);
  });

  it('throws a RecipeFileError (not a raw YAML parse error) on malformed YAML', () => {
    const filePath = writeTempRecipe('unityVersion: [unterminated\n');
    expect(() => RecipeFileReader.read(filePath)).toThrow(RecipeFileError);
  });
});
