/**
 * Reads/writes flat key->string localization tables in the two most
 * common generic interchange formats (a plain JSON object, and a
 * two-column CSV). Deliberately NOT engine-specific structured formats
 * (e.g. Unity's binary StringTable assets) - those need real
 * verification against an actual engine install before being guessed at,
 * same reasoning as this repo's other engine-specific plugins (see
 * plugins/gamemaker's README). A flat table is also what most small/
 * indie studios actually use in practice, and what several third-party
 * Unity localization import/export tools already read.
 */

export type LocalizationTable = Record<string, string>;

export type TableFormat = "json" | "csv";

export function detectFormat(filePath: string): TableFormat {
  if (filePath.toLowerCase().endsWith(".csv")) return "csv";
  if (filePath.toLowerCase().endsWith(".json")) return "json";
  throw new Error(`Cannot detect localization table format from file extension: "${filePath}" (expected .json or .csv).`);
}

export function parseTable(content: string, format: TableFormat): LocalizationTable {
  if (format === "json") {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Invalid localization table: expected a flat JSON object of key -> string.");
    }
    const table: LocalizationTable = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "string") {
        throw new Error(`Invalid localization table: value for key "${key}" is not a string.`);
      }
      table[key] = value;
    }
    return table;
  }

  return parseCsv(content);
}

export function serializeTable(table: LocalizationTable, format: TableFormat): string {
  if (format === "json") {
    return JSON.stringify(table, null, 2) + "\n";
  }
  return serializeCsv(table);
}

/** Minimal RFC 4180-ish CSV: comma-separated, double-quote-escaped fields, no multi-line-within-quotes support (not needed for a two-column key/value table). */
function parseCsv(content: string): LocalizationTable {
  const table: LocalizationTable = {};
  const lines = content.split(/\r\n|\n/).filter((line) => line.length > 0);

  for (const line of lines) {
    const [rawKey, ...rest] = splitCsvLine(line);
    if (rawKey === undefined) continue;
    table[rawKey] = rest.join(",");
  }

  return table;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function serializeCsv(table: LocalizationTable): string {
  return (
    Object.entries(table)
      .map(([key, value]) => `${csvField(key)},${csvField(value)}`)
      .join("\n") + "\n"
  );
}
