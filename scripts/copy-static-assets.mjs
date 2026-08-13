// tsc only compiles .ts files, so non-TS build artifacts checked into src/**/dist/
// (Dockerfiles, entrypoint scripts) need to be copied into the compiled dist/
// output by hand — otherwise runtime path lookups that resolve relative to the
// compiled file (e.g. Action.dockerfile in unity-activate/model/action.ts) point
// at a path that was never created.
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = 'src';
const DIST_ROOT = 'dist';

function findStaticDistDirs(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === 'dist') {
      found.push(path);
      continue;
    }
    found.push(...findStaticDistDirs(path));
  }
  return found;
}

for (const srcDistDir of findStaticDistDirs(SRC_ROOT)) {
  const relative = srcDistDir.slice(SRC_ROOT.length + 1);
  const destDir = join(DIST_ROOT, relative);
  cpSync(srcDistDir, destDir, { recursive: true });
  console.log(`copied ${srcDistDir} -> ${destDir}`);
}
