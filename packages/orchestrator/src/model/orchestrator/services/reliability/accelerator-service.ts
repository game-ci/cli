import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';

export type AcceleratorMode = 'enabled' | 'disabled' | 'download-only';

/**
 * Controls Unity Accelerator (cache server) behavior by patching
 * EditorSettings.asset before Unity launch.
 *
 * Modes:
 * - "enabled": Full Accelerator (upload + download)
 * - "disabled": Accelerator completely off
 * - "download-only": Pull from cache but don't upload (safe for CI)
 */
export class AcceleratorService {
  private static readonly EDITOR_SETTINGS_PATH = 'ProjectSettings/EditorSettings.asset';

  /**
   * Patch EditorSettings.asset to set the desired Accelerator mode.
   * Returns true if the file was modified.
   */
  static patchEditorSettings(projectPath: string, mode: AcceleratorMode): boolean {
    const settingsPath = path.join(projectPath, AcceleratorService.EDITOR_SETTINGS_PATH);

    if (!fs.existsSync(settingsPath)) {
      core.info(`[Accelerator] EditorSettings.asset not found at ${settingsPath}, skipping`);
      return false;
    }

    let content: string;
    try {
      content = fs.readFileSync(settingsPath, 'utf8');
    } catch (error: any) {
      core.warning(`[Accelerator] Failed to read EditorSettings.asset: ${error.message}`);
      return false;
    }

    let modified = false;
    let updatedContent = content;

    switch (mode) {
      case 'enabled':
        updatedContent = AcceleratorService.setAcceleratorEnabled(updatedContent, true);
        break;
      case 'disabled':
        updatedContent = AcceleratorService.setAcceleratorEnabled(updatedContent, false);
        break;
      case 'download-only':
        updatedContent = AcceleratorService.setAcceleratorEnabled(updatedContent, true);
        updatedContent = AcceleratorService.setUploadDisabled(updatedContent, true);
        break;
    }

    modified = updatedContent !== content;

    if (modified) {
      try {
        fs.writeFileSync(settingsPath, updatedContent, 'utf8');
        core.info(`[Accelerator] EditorSettings.asset patched to mode: ${mode}`);
      } catch (error: any) {
        core.warning(`[Accelerator] Failed to write EditorSettings.asset: ${error.message}`);
        return false;
      }
    } else {
      core.info(`[Accelerator] EditorSettings.asset already in mode: ${mode}`);
    }

    return modified;
  }

  private static setAcceleratorEnabled(content: string, enabled: boolean): string {
    const value = enabled ? '1' : '0';

    // Match m_CacheServerMode: <number>
    if (/m_CacheServerMode:\s*\d+/.test(content)) {
      return content.replace(
        /m_CacheServerMode:\s*\d+/,
        `m_CacheServerMode: ${enabled ? '2' : '0'}`,
      );
    }

    // If field doesn't exist, try to add it after m_CacheServerEndpoint or at end of EditorSettings block
    if (/m_CacheServerEndpoint:/.test(content)) {
      return content.replace(
        /(m_CacheServerEndpoint:[^\n]*\n)/,
        `$1  m_CacheServerMode: ${enabled ? '2' : '0'}\n`,
      );
    }

    return content;
  }

  private static setUploadDisabled(content: string, uploadDisabled: boolean): string {
    const value = uploadDisabled ? '1' : '0';

    // Match m_CacheServerEnableUpload: <number>
    if (/m_CacheServerEnableUpload:\s*\d+/.test(content)) {
      return content.replace(
        /m_CacheServerEnableUpload:\s*\d+/,
        `m_CacheServerEnableUpload: ${uploadDisabled ? '0' : '1'}`,
      );
    }

    return content;
  }
}
