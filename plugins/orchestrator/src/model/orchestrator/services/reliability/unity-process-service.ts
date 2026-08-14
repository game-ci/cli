import { execFileSync } from 'node:child_process';
import path from 'node:path';
import OrchestratorLogger from '../core/orchestrator-logger';

export interface UnityProcessCleanupResult {
  skipped: boolean;
  killedProcessIds: number[];
  hubRunning: boolean;
  licensingClientRunning: boolean;
}

export class UnityProcessService {
  static cleanupWorkspaceProcesses(projectPath: string): UnityProcessCleanupResult {
    if (process.platform !== 'win32') {
      return {
        skipped: true,
        killedProcessIds: [],
        hubRunning: false,
        licensingClientRunning: false,
      };
    }

    const normalizedProjectPath = path.resolve(projectPath);
    const script = UnityProcessService.buildCleanupScript(normalizedProjectPath);

    try {
      const output = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        {
          encoding: 'utf8',
          timeout: 60_000,
          windowsHide: true,
        },
      );

      const result = UnityProcessService.parseCleanupOutput(output);
      if (result.killedProcessIds.length > 0) {
        OrchestratorLogger.log(
          `[UnityProcess] Cleaned ${
            result.killedProcessIds.length
          } stale Unity process(es): ${result.killedProcessIds.join(', ')}`,
        );
      }

      if (!result.hubRunning) {
        OrchestratorLogger.logWarning('[UnityProcess] Unity Hub is not running');
      }
      if (!result.licensingClientRunning) {
        OrchestratorLogger.logWarning('[UnityProcess] Unity.Licensing.Client is not running');
      }

      return result;
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[UnityProcess] Workspace process cleanup failed: ${error.message}`,
      );

      return {
        skipped: false,
        killedProcessIds: [],
        hubRunning: false,
        licensingClientRunning: false,
      };
    }
  }

  static buildCleanupScript(projectPath: string): string {
    const escapedProjectPath = projectPath.replace(/'/g, "''");

    return `
$projectPath = '${escapedProjectPath}'
$escapedProjectPath = [Regex]::Escape($projectPath)
$killed = New-Object System.Collections.Generic.List[int]
$processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
$unityProcesses = @($processes | Where-Object {
  $_.Name -ieq 'Unity.exe' -and $_.CommandLine -match '(?i)-projectPath\\s+"?([^"]*)' -and $_.CommandLine -match $escapedProjectPath
})

foreach ($process in $unityProcesses) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    [void]$killed.Add([int]$process.ProcessId)
  } catch {}
}

$aliveIds = @{}
foreach ($process in $processes) {
  $aliveIds[[int]$process.ProcessId] = $true
}

$satelliteNames = @(
  'UnityShaderCompiler.exe',
  'UnityPackageManager.exe',
  'Unity.ILPP.Runner.exe',
  'Unity.ILPP.Trigger.exe',
  'UnityCrashHandler64.exe',
  'UnityAutoQuitter.exe'
)

$satellites = @($processes | Where-Object { $satelliteNames -contains $_.Name })
foreach ($process in $satellites) {
  $parentId = [int]$process.ParentProcessId
  if ($parentId -eq 0 -or -not $aliveIds.ContainsKey($parentId) -or ($unityProcesses | Where-Object { $_.ProcessId -eq $parentId })) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
      [void]$killed.Add([int]$process.ProcessId)
    } catch {}
  }
}

$hubRunning = @(Get-Process -Name 'Unity Hub' -ErrorAction SilentlyContinue).Count -gt 0
$licensingRunning = @(Get-Process -Name 'Unity.Licensing.Client' -ErrorAction SilentlyContinue).Count -gt 0

Write-Output ("KILLED=" + ($killed -join ','))
Write-Output ("HUB=" + $hubRunning)
Write-Output ("LICENSING=" + $licensingRunning)
`;
  }

  /**
   * Clean up crashed ILPP (IL Post Processing) processes scoped to the workspace.
   * ILPP runners can linger after Unity crashes and hold file locks on
   * ScriptAssemblies, causing subsequent builds to fail with access errors.
   *
   * Returns the number of ILPP processes killed.
   */
  static cleanupIlppProcesses(projectPath: string): number {
    if (process.platform !== 'win32') {
      return 0;
    }

    const normalizedProjectPath = path.resolve(projectPath);
    const escapedProjectPath = normalizedProjectPath.replace(/'/g, "''");

    const script = `
$projectPath = '${escapedProjectPath}'
$escapedProjectPath = [Regex]::Escape($projectPath)
$killed = 0
$processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
$ilppProcesses = @($processes | Where-Object {
  ($_.Name -ieq 'Unity.ILPP.Runner.exe' -or $_.Name -ieq 'Unity.ILPP.Trigger.exe') -and
  $_.CommandLine -match $escapedProjectPath
})

foreach ($process in $ilppProcesses) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    $killed++
  } catch {}
}

Write-Output ("ILPP_KILLED=" + $killed)
`;

    try {
      const output = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        {
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true,
        },
      );

      const match = output.match(/ILPP_KILLED=(\d+)/);
      const killed = match ? Number.parseInt(match[1], 10) : 0;

      if (killed > 0) {
        OrchestratorLogger.log(
          `[UnityProcess] Cleaned ${killed} stale ILPP process(es) for ${normalizedProjectPath}`,
        );
      }

      return killed;
    } catch (error: any) {
      OrchestratorLogger.logWarning(`[UnityProcess] ILPP process cleanup failed: ${error.message}`);
      return 0;
    }
  }

  static parseCleanupOutput(output: string): UnityProcessCleanupResult {
    const killedLine = output.split(/\r?\n/).find((line) => line.startsWith('KILLED='));
    const hubLine = output.split(/\r?\n/).find((line) => line.startsWith('HUB='));
    const licensingLine = output.split(/\r?\n/).find((line) => line.startsWith('LICENSING='));
    const killedProcessIds = (killedLine || 'KILLED=')
      .replace('KILLED=', '')
      .split(',')
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id));

    return {
      skipped: false,
      killedProcessIds,
      hubRunning: /True/i.test(hubLine || ''),
      licensingClientRunning: /True/i.test(licensingLine || ''),
    };
  }
}
