import { fsSync as fs, path, yaml, __dirname } from '../../dependencies.ts';

export class ActionYamlReader {
  private actionYamlParsed: any;
  public constructor() {
    let filename = `action.yml`;
    if (!fs.existsSync(filename)) {
      filename = path.join(__dirname, `..`, filename);
    }
    this.actionYamlParsed = yaml.parse(Deno.readTextFileSync(filename));
  }
  public GetActionYamlValue(key: string) {
    return this.actionYamlParsed.inputs[key]?.description || 'No description found in action.yml';
  }
}
