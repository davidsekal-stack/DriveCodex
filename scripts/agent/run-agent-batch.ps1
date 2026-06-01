[CmdletBinding()]
param(
  [int]$BatchSize = 5,
  [int]$SleepMs = 600,
  [string]$Phase,
  [string]$NodePath,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Resolve-NodeExe {
  param(
    [string]$RequestedNodePath,
    [string]$RepoRoot
  )

  if ($RequestedNodePath) {
    $resolved = Resolve-Path $RequestedNodePath -ErrorAction Stop
    return $resolved.Path
  }

  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Path
  }

  $fallback = Join-Path $RepoRoot '.tools\node-v22.22.1-win-x64\node.exe'
  if (Test-Path $fallback) {
    return (Resolve-Path $fallback).Path
  }

  throw 'Could not resolve node.exe. Pass -NodePath explicitly.'
}

function New-MutexName {
  param([string]$RepoRoot)

  $md5 = [System.Security.Cryptography.MD5]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($RepoRoot.ToLowerInvariant())
    $hash = [System.BitConverter]::ToString($md5.ComputeHash($bytes)).Replace('-', '')
    return "Local\DriveCodexAgentBatch_$hash"
  } finally {
    $md5.Dispose()
  }
}

function Write-LogLine {
  param(
    [string]$Path,
    [string]$Message
  )

  Add-Content -Path $Path -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
}

$repoRoot = Resolve-RepoRoot
$agentDir = (Resolve-Path $PSScriptRoot).Path
$nodeExe = Resolve-NodeExe -RequestedNodePath $NodePath -RepoRoot $repoRoot
$logRoot = if ($LogDir) { $LogDir } else { Join-Path $agentDir 'logs' }
$null = New-Item -ItemType Directory -Path $logRoot -Force
$logPath = Join-Path $logRoot ("agent-batch-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

$mutexName = New-MutexName -RepoRoot $repoRoot
$mutex = [System.Threading.Mutex]::new($false, $mutexName)
$lockTaken = $false

try {
  try {
    $lockTaken = $mutex.WaitOne(0)
  } catch [System.Threading.AbandonedMutexException] {
    $lockTaken = $true
  }

  if (-not $lockTaken) {
    Write-LogLine -Path $logPath -Message "Skip: another batch run is already active."
    exit 0
  }

  Set-Location $repoRoot

  # ── Step 1: refresh the cross-source "already-extracted" index from the DB (NON-FATAL) ──
  # Keeps crawled-index.json current so the orchestrator skips anything already extracted
  # (by this agent, the legacy forum-seed scripts, or NHTSA) since the last batch.
  # A failure here must NOT abort the crawl: log a warning and proceed on the existing snapshot.
  $indexBuilder = Join-Path $agentDir 'build-crawled-index.mjs'
  Write-LogLine -Path $logPath -Message "Refreshing crawled-index from DB..."
  $idxOut = [System.IO.Path]::GetTempFileName()
  $idxErr = [System.IO.Path]::GetTempFileName()
  try {
    $idxProc = Start-Process `
      -FilePath $nodeExe `
      -ArgumentList @($indexBuilder) `
      -WorkingDirectory $repoRoot `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $idxOut `
      -RedirectStandardError $idxErr

    foreach ($idxStream in @($idxOut, $idxErr)) {
      if (-not (Test-Path $idxStream)) { continue }
      $idxContent = Get-Content $idxStream -Raw
      if ([string]::IsNullOrWhiteSpace($idxContent)) { continue }
      Add-Content -Path $logPath -Value $idxContent.TrimEnd("`r", "`n")
    }

    if ([int]$idxProc.ExitCode -ne 0) {
      Write-LogLine -Path $logPath -Message ("WARN: index refresh exit_code={0}; proceeding with existing snapshot." -f $idxProc.ExitCode)
    }
  } catch {
    Write-LogLine -Path $logPath -Message ("WARN: index refresh failed ({0}); proceeding with existing snapshot." -f $_.Exception.Message)
  } finally {
    Remove-Item $idxOut, $idxErr -ErrorAction SilentlyContinue
  }

  $orchestrator = Join-Path $agentDir 'orchestrator.mjs'
  $args = @(
    '--experimental-sqlite',
    $orchestrator,
    '--batch-size',
    [string]$BatchSize,
    '--sleep-ms',
    [string]$SleepMs
  )

  if ($Phase) {
    $args += @('--phase', $Phase)
  }

  Write-LogLine -Path $logPath -Message ("START node={0} args={1}" -f $nodeExe, ($args -join ' '))

  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()

  try {
    $process = Start-Process `
      -FilePath $nodeExe `
      -ArgumentList $args `
      -WorkingDirectory $repoRoot `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    foreach ($streamPath in @($stdoutPath, $stderrPath)) {
      if (-not (Test-Path $streamPath)) { continue }
      $content = Get-Content $streamPath -Raw
      if ([string]::IsNullOrWhiteSpace($content)) { continue }
      Add-Content -Path $logPath -Value $content.TrimEnd("`r", "`n")
      Write-Output $content.TrimEnd("`r", "`n")
    }

    $exitCode = [int]$process.ExitCode
  }
  finally {
    Remove-Item $stdoutPath, $stderrPath -ErrorAction SilentlyContinue
  }

  Write-LogLine -Path $logPath -Message ("END exit_code={0}" -f $exitCode)
  exit $exitCode
}
finally {
  if ($lockTaken) {
    try { $mutex.ReleaseMutex() } catch { }
  }
  $mutex.Dispose()
}
