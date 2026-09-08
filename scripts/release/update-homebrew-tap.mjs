#!/usr/bin/env node
/**
 * Bumps game-ci/homebrew-tap's Formula/game-ci.rb to a new CLI release:
 * updates `version` and the 4 macos/linux url+sha256 pairs (brew doesn't
 * need windows) from the release's checksums.txt.
 *
 * Usage: node update-homebrew-tap.mjs <version e.g. 0.1.52> <checksums.txt path> <formula path>
 */
import fs from 'node:fs';

const [, , rawVersion, checksumsPath, formulaPath] = process.argv;
if (!rawVersion || !checksumsPath || !formulaPath) {
  console.error('Usage: update-homebrew-tap.mjs <version> <checksums.txt> <Formula/game-ci.rb>');
  process.exit(1);
}
const version = rawVersion.replace(/^v/, '');

const checksums = new Map();
for (const line of fs.readFileSync(checksumsPath, 'utf8').split('\n')) {
  const [sha, name] = line.trim().split(/\s+/);
  if (sha && name) checksums.set(name, sha);
}

// brew has no windows build; these are the only 4 assets the formula pins.
const PLATFORMS = ['macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'];

let formula = fs.readFileSync(formulaPath, 'utf8');

const versionCount = (formula.match(/version "[^"]+"/g) || []).length;
if (versionCount !== 1) {
  throw new Error(`Expected exactly one 'version "..."' line in ${formulaPath}, found ${versionCount}`);
}
formula = formula.replace(/version "[^"]+"/, `version "${version}"`);

for (const platform of PLATFORMS) {
  const assetName = `game-ci-${platform}.tar.gz`;
  const sha = checksums.get(assetName);
  if (!sha) {
    throw new Error(`checksums.txt has no entry for ${assetName}`);
  }

  const urlPattern = new RegExp(
    `(url "https://github\\.com/game-ci/cli/releases/download/)v[^/]+(/${assetName}")\\r?\\n(\\s*sha256 ")[0-9a-f]+(")`,
  );
  if (!urlPattern.test(formula)) {
    throw new Error(`Could not find a url/sha256 pair for ${assetName} in ${formulaPath}`);
  }
  formula = formula.replace(urlPattern, `$1v${version}$2\n$3${sha}$4`);
}

fs.writeFileSync(formulaPath, formula);
console.log(`Updated ${formulaPath} to version ${version}`);
