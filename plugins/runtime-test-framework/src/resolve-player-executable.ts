import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Resolves the actual executable to launch from a built player's output
 * directory (or a direct path to the executable itself). buildPath's
 * shape genuinely differs per platform:
 *
 *  - Windows: buildPath is either the .exe itself, or a directory
 *    containing exactly one .exe alongside the Data folder etc.
 *  - macOS: buildPath is either a .app bundle, or a directory containing
 *    exactly one .app - the real executable lives at
 *    <bundle>/Contents/MacOS/<name matching the bundle's own base name>.
 *  - Linux: buildPath is either the executable itself, or a directory
 *    containing exactly one file with the executable bit set.
 */
export function resolvePlayerExecutable(buildPath: string, platform: NodeJS.Platform = process.platform): string {
  const stat = fs.statSync(buildPath);

  if (platform === "darwin") {
    const appBundle =
      stat.isDirectory() && buildPath.endsWith(".app")
        ? buildPath
        : findSingleMatch(buildPath, stat, (name) => name.endsWith(".app"));
    const bundleName = path.basename(appBundle, ".app");
    const macOsBinary = path.join(appBundle, "Contents", "MacOS", bundleName);
    if (!fs.existsSync(macOsBinary)) {
      throw new Error(
        `Expected a macOS executable at ${macOsBinary} (derived from the .app bundle's own name) but it does not exist.`,
      );
    }
    return macOsBinary;
  }

  if (platform === "win32") {
    if (stat.isFile() && buildPath.endsWith(".exe")) return buildPath;
    return findSingleMatch(buildPath, stat, (name) => name.endsWith(".exe"));
  }

  // Linux and anything else POSIX-like: an executable file, or the one
  // executable-bit file in a directory.
  if (stat.isFile()) return buildPath;
  return findSingleMatch(buildPath, stat, (name, fullPath) => {
    try {
      const fileStat = fs.statSync(fullPath);
      return fileStat.isFile() && (fileStat.mode & 0o111) !== 0;
    } catch {
      return false;
    }
  });
}

function findSingleMatch(
  buildPath: string,
  stat: fs.Stats,
  predicate: (name: string, fullPath: string) => boolean,
): string {
  if (!stat.isDirectory()) {
    throw new Error(`${buildPath} is neither a matching executable nor a directory containing one.`);
  }

  const entries = fs.readdirSync(buildPath);
  const matches = entries.filter((name) => predicate(name, path.join(buildPath, name)));

  if (matches.length === 0) {
    throw new Error(`No player executable found in ${buildPath}.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple candidate executables found in ${buildPath}: ${matches.join(", ")}. Pass the exact executable path instead.`,
    );
  }

  return path.join(buildPath, matches[0]);
}
