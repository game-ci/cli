import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  EMBEDDED_ASSETS_GZIP_BASE64,
  EMBEDDED_ASSETS_INDEX,
  EMBEDDED_ASSETS_SIZE,
} from '../src/generated/embedded-assets.ts';

const outputDir = path.resolve(process.argv[2] || 'dist');
const payload = gunzipSync(Buffer.from(EMBEDDED_ASSETS_GZIP_BASE64, 'base64'));

if (payload.length !== EMBEDDED_ASSETS_SIZE) {
  throw new Error(
    `Embedded assets are corrupt: expected ${EMBEDDED_ASSETS_SIZE}, got ${payload.length}`,
  );
}

for (const entry of EMBEDDED_ASSETS_INDEX) {
  const destination = path.join(outputDir, ...entry.p.split('/'));
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, payload.subarray(entry.o, entry.o + entry.l), {
    mode: entry.x ? 0o755 : 0o644,
  });
}

process.stdout.write(`${outputDir}\n`);
