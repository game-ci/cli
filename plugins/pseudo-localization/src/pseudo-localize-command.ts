import * as fs from "node:fs";
import * as path from "node:path";
import { pseudoLocalize } from "./pseudo-loc-transform";
import { detectFormat, parseTable, serializeTable } from "./localization-table";

export interface PseudoLocalizeOptionsInput {
  projectPath?: string;
  sourceLocale?: string;
  outputLocale?: string;
  expansionFactor?: number;
  outputPath?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

export class PseudoLocalizeCommand {
  public readonly name = "Pseudo-localize";

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("sourceLocale", {
        describe: 'Source locale table to read, e.g. "en" reads <projectPath>/en.json or en.csv.',
        type: "string",
        default: "en",
      })
      .option("outputLocale", {
        describe: "Locale code the pseudo-localized table is written under.",
        type: "string",
        default: "qps-ploc",
      })
      .option("expansionFactor", {
        describe: "Length multiplier applied to each string, simulating languages that run longer than English.",
        type: "number",
        default: 1.3,
      })
      .option("outputPath", {
        describe: "Directory to write the output table into. Defaults to projectPath.",
        type: "string",
      });
  }

  public async execute(options: PseudoLocalizeOptionsInput): Promise<boolean> {
    const projectPath = options.projectPath;
    if (!projectPath) {
      throw new Error("A project path is required: game-ci pseudo-localize <projectPath>");
    }
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    const sourceLocale = options.sourceLocale ?? "en";
    const outputLocale = options.outputLocale ?? "qps-ploc";
    const expansionFactor = options.expansionFactor ?? 1.3;

    const sourceFile = this.findSourceFile(projectPath, sourceLocale);
    const format = detectFormat(sourceFile);
    const table = parseTable(fs.readFileSync(sourceFile, "utf8"), format);

    const keys = Object.keys(table);
    if (keys.length === 0) {
      throw new Error(`Source table "${sourceFile}" contains no strings.`);
    }

    const pseudoTable: Record<string, string> = {};
    for (const [key, value] of Object.entries(table)) {
      pseudoTable[key] = pseudoLocalize(value, { expansionFactor });
    }

    const outputDir = options.outputPath ? path.resolve(options.outputPath) : path.resolve(projectPath);
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `${outputLocale}.${format}`);
    fs.writeFileSync(outputFile, serializeTable(pseudoTable, format), "utf8");

    console.log(`Pseudo-localized ${keys.length} string(s) from "${sourceFile}" to "${outputFile}".`);

    return true;
  }

  private findSourceFile(projectPath: string, sourceLocale: string): string {
    for (const extension of ["json", "csv"]) {
      const candidate = path.join(projectPath, `${sourceLocale}.${extension}`);
      if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(
      `No source localization table found for locale "${sourceLocale}" in "${projectPath}" (looked for ${sourceLocale}.json and ${sourceLocale}.csv).`,
    );
  }
}
