#!/usr/bin/env node
/**
 * Generates src/generated/embedded-assets.ts from dist/.
 *
 * The compiled binary is not self-contained: cli.ts resolves static assets
 * (default-build-script/, platforms/*, unity-config/) from a dist/ directory
 * that has to exist as a real path on disk, because those paths are mounted
 * into Docker containers during a build. `bun build --compile` only bundles
 * JS/TS reachable via static imports, so historically dist/ had to ship as a
 * sibling of the binary inside a release archive (game-ci/cli#73).
 *
 * Any packaging that separates the two produces a binary that passes
 * `--help` and then fails on a real build - which is exactly how the install
 * scripts stayed broken unnoticed, and why action.yml needed special-casing.
 * Embedding the assets removes that whole class of failure: the binary
 * extracts them to a content-addressed cache on first use instead.
 *
 * The output is committed, the same way plugins/unity/dist is, and CI checks
 * it is up to date.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const outFile = path.join(repoRoot, 'src', 'generated', 'embedded-assets.ts');

if (!fs.existsSync(distDir)) {
  console.error(`dist/ not found at ${distDir}. Run the dist build first.`);
  process.exit(1);
}

/** Relative POSIX paths keep the manifest identical across build platforms. */
function walk(dir, base = '') {
  const entries = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) {
      console.error(`Symlink in dist/ is not supported by the embedded-asset format: ${rel}`);
      process.exit(1);
    }
    if (stat.isDirectory()) {
      entries.push(...walk(abs, rel));
    } else if (stat.isFile()) {
      entries.push({ rel, abs, mode: stat.mode });
    }
  }
  return entries;
}

/**
 * Executable bits come from git, not the filesystem. Windows checkouts do not
 * carry a POSIX exec bit at all, so generating on Windows would silently mark
 * every file non-executable while generating on Linux might not - producing a
 * different payload per build host. git's index mode is the same everywhere
 * and is what the release archive already reflects.
 */
const NEWLINE = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const DIST_PREFIX = new RegExp('^dist/');

/**
 * Reads dist/ out of git rather than the working tree.
 *
 * Both the contents and the executable bits have to come from git, or the
 * payload depends on which machine built it:
 *
 *   - Line endings. A Windows checkout with core.autocrlf gets CRLF, so
 *     embedding the working tree there produces shell scripts starting
 *     "#!/usr/bin/env bash
" - a broken interpreter line inside the Linux
 *     container, which would fail every Unity build. Releases are built on
 *     Linux (LF), so git's blob is also exactly what the release archive
 *     ships.
 *   - Executable bits. Windows checkouts carry no POSIX exec bit at all.
 *
 * Falls back to the working tree outside a git checkout (e.g. building from
 * a source tarball), which is at least correct on POSIX.
 */
function readFromGit() {
  let listing;
  try {
    listing = execFileSync('git', ['ls-files', '-s', '--', 'dist'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }

  const entries = [];
  for (const line of listing.split(NEWLINE)) {
    if (!line) continue;
    const [meta, filePath] = line.split(TAB);
    if (!filePath) continue;
    const [mode, oid] = meta.split(' ');
    entries.push({ rel: filePath.replace(DIST_PREFIX, ''), oid, executable: mode === '100755' });
  }

  if (entries.length === 0) return null;

  // One batch call rather than 141 separate `git show` invocations.
  const batch = execFileSync('git', ['cat-file', '--batch'], {
    cwd: repoRoot,
    input: entries.map((entry) => entry.oid).join(NEWLINE) + NEWLINE,
    maxBuffer: 512 * 1024 * 1024,
  });

  // Each record is a header line "<oid> blob <size>", then that many
  // bytes of contents, then a newline. Walked by byte offset because the
  // contents are binary and may themselves contain newlines.
  const files = [];
  let offset = 0;
  for (const entry of entries) {
    const headerEnd = batch.indexOf(NEWLINE, offset);
    if (headerEnd === -1) throw new Error(`Malformed git cat-file output for ${entry.rel}`);
    const header = batch.subarray(offset, headerEnd).toString('utf8').split(' ');
    const size = Number(header[2]);
    if (!Number.isFinite(size)) throw new Error(`Unexpected git cat-file header for ${entry.rel}: ${header.join(' ')}`);
    const contentStart = headerEnd + 1;
    files.push({
      rel: entry.rel,
      data: batch.subarray(contentStart, contentStart + size),
      executable: entry.executable,
    });
    offset = contentStart + size + 1;
  }

  return files;
}

const gitFiles = readFromGit();
const files =
  gitFiles ??
  walk(distDir).map((file) => ({
    rel: file.rel,
    data: fs.readFileSync(file.abs),
    executable: (file.mode & 0o111) !== 0,
  }));

if (!gitFiles) {
  console.warn('Not a git checkout - falling back to working-tree contents and permissions.');
}

// Contents are concatenated into one blob and addressed by offset/length,
// rather than base64-encoded per file inside the JSON. Base64 inflates by
// 4/3 *before* compression, so encoding per file made the payload ~57%
// larger than compressing the raw bytes once.
const index = [];
const chunks = [];
let offset = 0;
for (const file of files) {
  chunks.push(file.data);
  index.push({
    p: file.rel,
    o: offset,
    l: file.data.length,
    // Only the executable bit is carried; everything else gets a fixed 0644
    // so output is reproducible regardless of the builder's umask. The shell
    // scripts under platforms/* are NOT executable today and need not be -
    // docker.ts invokes them through an explicit interpreter
    // ("/bin/bash /entrypoint.sh"), and the release archive ships them 0644.
    ...(file.executable ? { x: 1 } : {}),
  });
  offset += file.data.length;
}

const blob = Buffer.concat(chunks);
const gzipped = gzipSync(blob, { level: 9 });
const base64 = gzipped.toString('base64');
const hash = createHash('sha256').update(gzipped).digest('hex').slice(0, 16);

const banner = `// @generated by scripts/generate-embedded-assets.mjs - do not edit by hand.
// Regenerate with: bun run build:assets
//
// Holds dist/ (${files.length} files) as one gzipped, base64-encoded blob so
// the compiled binary carries its own static assets instead of relying on a
// sibling dist/ directory shipped alongside it. See the generator for why.
`;

const contents = `${banner}
/** sha256 of the compressed payload, used as the extraction cache key. */
export const EMBEDDED_ASSETS_HASH = '${hash}';

/** Uncompressed size of the blob, in bytes. */
export const EMBEDDED_ASSETS_SIZE = ${blob.length};

/** Where each file lives in the decompressed blob: path, offset, length, executable. */
export const EMBEDDED_ASSETS_INDEX: { p: string; o: number; l: number; x?: 1 }[] = ${JSON.stringify(index)};

export const EMBEDDED_ASSETS_GZIP_BASE64 =
  '${base64}';
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, contents);

console.log(
  `Embedded ${files.length} files (${(blob.length / 1024).toFixed(1)} KiB raw, ${(gzipped.length / 1024).toFixed(1)} KiB compressed, hash ${hash}) -> ${path.relative(repoRoot, outFile)}`,
);
