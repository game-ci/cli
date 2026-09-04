import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { fsSync as fs, path, process } from '../dependencies.ts';
import { EmbeddedAssets } from './embedded-assets.ts';
import { EMBEDDED_ASSETS_HASH, EMBEDDED_ASSETS_INDEX } from '../generated/embedded-assets.ts';

// A real HOME is redirected to a temp directory so these exercise the actual
// gunzip/write/rename path rather than a mock of it.
describe('EmbeddedAssets', () => {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const originalOverride = process.env[EmbeddedAssets.overrideEnvVar];
  let tempHome: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'game-ci-assets-test-'));
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    delete process.env[EmbeddedAssets.overrideEnvVar];
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    if (originalOverride === undefined) delete process.env[EmbeddedAssets.overrideEnvVar];
    else process.env[EmbeddedAssets.overrideEnvVar] = originalOverride;

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('extracts every embedded file to a real directory', () => {
    const dir = EmbeddedAssets.resolve();

    expect(fs.existsSync(dir)).toBe(true);
    for (const entry of EMBEDDED_ASSETS_INDEX) {
      const file = path.join(dir, ...entry.p.split('/'));
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBe(entry.l);
    }
  });

  it('extracts the assets Docker actually mounts', () => {
    const dir = EmbeddedAssets.resolve();

    // These are the paths docker.ts bind-mounts; if any of them stops being
    // embedded, builds break in the container rather than here.
    expect(fs.existsSync(path.join(dir, 'platforms', 'ubuntu', 'entrypoint.sh'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'default-build-script'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'unity-config'))).toBe(true);
  });

  it('reproduces the permissions recorded in the manifest', () => {
    const dir = EmbeddedAssets.resolve();

    // Deliberately checks round-trip fidelity against the manifest rather
    // than asserting a specific bit. The scripts under platforms/* are NOT
    // executable - the release archive ships them 0644 and docker.ts runs
    // them through an explicit interpreter ("/bin/bash /entrypoint.sh") - so
    // asserting they are executable would encode a requirement that has
    // never been true. The manifest's bits come from git, so they are the
    // same regardless of which OS built the payload.
    if (process.platform === 'win32') return; // no POSIX mode to compare

    for (const entry of EMBEDDED_ASSETS_INDEX) {
      const mode = fs.statSync(path.join(dir, ...entry.p.split('/'))).mode & 0o111;
      if (entry.x) expect(mode).toBeGreaterThan(0);
      else expect(mode).toBe(0);
    }
  });

  it('caches by content hash, and reuses an existing extraction', () => {
    const first = EmbeddedAssets.resolve();
    expect(path.basename(first)).toBe(EMBEDDED_ASSETS_HASH);

    const marker = path.join(first, '.complete');
    const before = fs.statSync(marker).mtimeMs;

    const second = EmbeddedAssets.resolve();

    expect(second).toBe(first);
    expect(fs.statSync(marker).mtimeMs).toBe(before);
  });

  it('re-extracts when a previous run was interrupted before completing', () => {
    const dir = EmbeddedAssets.resolve();
    // Simulate a half-written tree: files present, completion marker absent.
    fs.rmSync(path.join(dir, '.complete'));
    fs.rmSync(path.join(dir, 'platforms', 'ubuntu', 'entrypoint.sh'));

    const resolved = EmbeddedAssets.resolve();

    expect(resolved).toBe(dir);
    expect(fs.existsSync(path.join(dir, 'platforms', 'ubuntu', 'entrypoint.sh'))).toBe(true);
  });

  it('honours the override env var without extracting', () => {
    process.env[EmbeddedAssets.overrideEnvVar] = '/somewhere/else/dist';

    expect(EmbeddedAssets.resolve()).toBe('/somewhere/else/dist');
    expect(fs.existsSync(EmbeddedAssets.targetDir())).toBe(false);
  });

  it('falls back to a sibling dist/ when the cache cannot be written', () => {
    const sibling = path.join(tempHome, 'sibling-dist');
    fs.mkdirSync(sibling, { recursive: true });
    // An unwritable HOME is the realistic trigger (read-only or locked-down
    // container users); force the same outcome by making the cache root a
    // file, so creating a directory beneath it cannot succeed.
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.mkdirSync(tempHome, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(tempHome, '.game-ci'), 'not a directory');

    expect(EmbeddedAssets.resolve(sibling)).toBe(sibling);
  });

  it('throws something actionable when there is no cache and no fallback', () => {
    fs.rmSync(tempHome, { recursive: true, force: true });
    fs.mkdirSync(tempHome, { recursive: true });
    fs.writeFileSync(path.join(tempHome, '.game-ci'), 'not a directory');

    expect(() => EmbeddedAssets.resolve()).toThrow(/mounted into the Docker container/);
  });
});
