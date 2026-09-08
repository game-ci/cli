#!/usr/bin/env node
/**
 * Bumps game-ci/scoop-bucket's bucket/game-ci.json to a new CLI release:
 * updates `version` and the single windows-x64 url+hash from the release's
 * checksums.txt.
 *
 * Usage: node update-scoop-bucket.mjs <version e.g. 0.1.52> <checksums.txt path> <manifest path>
 */
import fs from 'node:fs';

const [, , rawVersion, checksumsPath, manifestPath] = process.argv;
if (!rawVersion || !checksumsPath || !manifestPath) {
  console.error('Usage: update-scoop-bucket.mjs <version> <checksums.txt> <bucket/game-ci.json>');
  process.exit(1);
}
const version = rawVersion.replace(/^v/, '');

const checksums = new Map();
for (const line of fs.readFileSync(checksumsPath, 'utf8').split('\n')) {
  const [sha, name] = line.trim().split(/\s+/);
  if (sha && name) checksums.set(name, sha);
}

const assetName = 'game-ci-windows-x64.zip';
const hash = checksums.get(assetName);
if (!hash) {
  throw new Error(`checksums.txt has no entry for ${assetName}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = version;
manifest.architecture['64bit'].url = `https://github.com/game-ci/cli/releases/download/v${version}/${assetName}`;
manifest.architecture['64bit'].hash = hash;

// Match the repo's existing 4-space indentation and trailing newline.
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
console.log(`Updated ${manifestPath} to version ${version}`);
