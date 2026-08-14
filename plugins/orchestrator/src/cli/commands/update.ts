import type { CommandModule } from 'yargs';
import * as core from '@actions/core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const REPO = 'game-ci/orchestrator';

interface GitHubRelease {
  // eslint-disable-next-line camelcase
  tag_name: string;
  assets: Array<{
    name: string;
    // eslint-disable-next-line camelcase
    browser_download_url: string;
    size: number;
  }>;
}

interface UpdateArguments {
  force?: boolean;
  version?: string;
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const get = (targetUrl: string, redirectCount: number) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));

        return;
      }
      https
        .get(
          targetUrl,
          {
            headers: { 'User-Agent': 'game-ci-cli', Accept: 'application/json' },
          },
          (response) => {
            if (
              response.statusCode &&
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location
            ) {
              get(response.headers.location, redirectCount + 1);

              return;
            }
            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode} from ${targetUrl}`));

              return;
            }
            let data = '';
            response.on('data', (chunk) => (data += chunk));
            response.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                reject(new Error('Invalid JSON response'));
              }
            });
          },
        )
        .on('error', reject);
    };
    get(url, 0);
  });
}

function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const get = (targetUrl: string, redirectCount: number) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));

        return;
      }

      const protocol = targetUrl.startsWith('https') ? https : http;
      protocol
        .get(targetUrl, { headers: { 'User-Agent': 'game-ci-cli' } }, (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            get(response.headers.location, redirectCount + 1);

            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} downloading ${targetUrl}`));

            return;
          }
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', reject);
    };
    get(url, 0);
  });
}

function getCurrentVersion(): string {
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'package.json'),
    path.join(__dirname, '..', '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const packageData = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (packageData.version) {
          return packageData.version;
        }
      } catch {
        // Continue to next candidate
      }
    }
  }

  return 'unknown';
}

function getAssetName(): string {
  const platform = process.platform;
  const arch = process.arch;

  let osPart: string;
  switch (platform) {
    case 'linux':
      osPart = 'linux';
      break;
    case 'darwin':
      osPart = 'macos';
      break;
    case 'win32':
      osPart = 'windows';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  let archPart: string;
  switch (arch) {
    case 'x64':
      archPart = 'x64';
      break;
    case 'arm64':
      archPart = 'arm64';
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  const assetBaseName = `game-ci-${osPart}-${archPart}`;

  return osPart === 'windows' ? `${assetBaseName}.exe` : assetBaseName;
}

function getExecutablePath(): string | undefined {
  if ((process as any).pkg) {
    return process.execPath;
  }

  const installDirectory =
    process.env.GAME_CI_INSTALL || path.join(os.homedir(), '.game-ci', 'bin');
  const binaryName = process.platform === 'win32' ? 'game-ci.exe' : 'game-ci';
  const installedPath = path.join(installDirectory, binaryName);

  if (fs.existsSync(installedPath)) {
    return installedPath;
  }

  return;
}

function parseVersionParts(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number(part));
}

function compareSemver(a: string, b: string): number {
  const partsA = parseVersionParts(a);
  const partsB = parseVersionParts(b);

  for (let index = 0; index < 3; index++) {
    const x = partsA[index] || 0;
    const y = partsB[index] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }

  return 0;
}

const updateCommand: CommandModule<object, UpdateArguments> = {
  command: 'update',
  describe: 'Update game-ci to the latest version',
  builder: (yargs) => {
    return yargs
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Force update even if already on latest version',
        default: false,
      })
      .option('version', {
        type: 'string',
        description: 'Update to a specific version (e.g., v2.0.0)',
        default: '',
      })
      .example('game-ci update', 'Update to the latest version')
      .example('game-ci update --version v2.1.0', 'Update to a specific version')
      .example('game-ci update --force', 'Force reinstall of the current version') as any;
  },
  handler: async (cliArguments) => {
    try {
      const currentVersion = getCurrentVersion();
      core.info(`Current version: v${currentVersion}`);
      core.info(`Platform: ${process.platform} ${process.arch}`);
      core.info('');

      let release: GitHubRelease;
      const targetVersion = cliArguments.version as string;

      if (targetVersion) {
        const tag = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
        core.info(`Fetching release ${tag}...`);
        release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`);
      } else {
        core.info('Checking for updates...');
        release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`);
      }

      const latestVersion = release.tag_name;
      core.info(`Latest version:  ${latestVersion}`);
      core.info('');

      const comparison = compareSemver(currentVersion, latestVersion);
      if (comparison >= 0 && !cliArguments.force) {
        core.info('You are already on the latest version. Use --force to reinstall.');

        return;
      }

      if (comparison > 0 && !targetVersion) {
        core.info(
          `Current version (v${currentVersion}) is newer than latest release (${latestVersion}).`,
        );
        core.info('Use --force to downgrade, or --version to target a specific release.');

        return;
      }

      const assetName = getAssetName();
      const asset = release.assets.find((a) => a.name === assetName);

      if (!asset) {
        const available = release.assets.map((a) => a.name).join(', ');
        throw new Error(
          `No binary found for ${process.platform}-${process.arch} (looking for ${assetName}).\nAvailable assets: ${available}`,
        );
      }

      const sizeMb = (asset.size / (1024 * 1024)).toFixed(1);
      core.info(`Downloading ${assetName} (${sizeMb} MB)...`);

      const binaryData = await downloadFile(asset.browser_download_url);

      const executablePath = getExecutablePath();

      if (!executablePath) {
        core.info('');
        core.info('game-ci is running via Node.js (not as a standalone binary).');
        core.info('To update the npm package, run:');
        core.info('  npm install -g @game-ci/orchestrator@latest');
        core.info('');
        core.info('To install the standalone binary instead:');
        core.info(
          '  curl -fsSL https://raw.githubusercontent.com/game-ci/orchestrator/main/install.sh | sh',
        );

        return;
      }

      const temporaryPath = `${executablePath}.update`;
      const backupPath = `${executablePath}.backup`;

      fs.writeFileSync(temporaryPath, binaryData);

      if (process.platform !== 'win32') {
        fs.chmodSync(temporaryPath, 0o755);
      }

      try {
        const output = execFileSync(temporaryPath, ['version'], {
          encoding: 'utf8',
          timeout: 10_000,
        });
        core.info(`Verified new binary: ${output.trim().split('\n')[0]}`);
      } catch (verifyError: any) {
        fs.unlinkSync(temporaryPath);
        throw new Error(`Downloaded binary failed verification: ${verifyError.message}`, {
          cause: verifyError,
        });
      }

      try {
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        fs.renameSync(executablePath, backupPath);
        fs.renameSync(temporaryPath, executablePath);

        try {
          fs.unlinkSync(backupPath);
        } catch {
          // On Windows the backup may be locked; that is fine
        }
      } catch (replaceError: any) {
        if (fs.existsSync(backupPath) && !fs.existsSync(executablePath)) {
          fs.renameSync(backupPath, executablePath);
        }

        if (fs.existsSync(temporaryPath)) {
          fs.unlinkSync(temporaryPath);
        }
        throw new Error(`Failed to replace binary: ${replaceError.message}`, {
          cause: replaceError,
        });
      }

      core.info('');
      core.info(`Successfully updated game-ci to ${latestVersion}`);
    } catch (error: any) {
      core.error(`Update failed: ${error.message}`);

      throw error;
    }
  },
};

export default updateCommand;
