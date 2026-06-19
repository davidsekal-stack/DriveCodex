[CmdletBinding()]
param(
  [string]$NodePath,
  [string]$LogDir
)

# Dedicated post-night runner for the recall watchdog + daily coach.
# Fires ONCE per morning from the DriveCodexDailyCoach scheduled task (~06:20),
# AFTER the 21:00–06:00 crawl window closes — so the coach evaluates the full,
# just-finished night (the 5-min crawl batch can't: it only runs inside the window).
# Both scripts self-gate to once/local-day; this wrapper just runs them, captures
# output, and mirrors the watchdog's alert file to a Desktop marker.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$agentDir = (Resolve-Path $PSScriptRoot).Path
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-NodeExe {
  param([string]$RequestedNodePath, [string]$RepoRoot)
  if ($RequestedNodePath) { return (Resolve-Path $RequestedNodePath -ErrorAction Stop).Path }
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }
  $fallback = Join-Path $RepoRoot '.tools\node-v22.22.1-win-x64\node.exe'
  if (Test-Path $fallback) { return (Resolve-Path $fallback).Path }
  throw 'Could not resolve node.exe. Pass -NodePath explicitly.'
}

function Write-LogLine { param([string]$Path, [string]$Message)
  Add-Content -Path $Path -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
}

# Load KEY=VALUE secrets from .env.local (Supabase service key, DeepSeek key) into
# the process env for the child node runs. Existing env wins. Never logs values.
function Import-DotEnv { param([string]$Path)
  if (-not (Test-Path $Path)) { return 0 }
  $count = 0
  foreach ($line in (Get-Content $Path -ErrorAction SilentlyContinue)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $eq = $trimmed.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $val = $trimmed.Substring($eq + 1).Trim().Trim('"').Trim("'")
    if (-not $key) { continue }
    if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($key, 'Process'))) {
      Set-Item -Path ("Env:{0}" -f $key) -Value $val
      $count++
    }
  }
  return $count
}

# Run one node script (--experimental-sqlite), capture stdout+stderr into the log. Non-fatal.
function Invoke-NodeStep { param([string]$NodeExe, [string]$Script, [string]$LogPath, [string]$RepoRoot, [string]$Label)
  if (-not (Test-Path $Script)) { return }
  Write-LogLine -Path $LogPath -Message ("Running {0}..." -f $Label)
  $out = [System.IO.Path]::GetTempFileName()
  $err = [System.IO.Path]::GetTempFileName()
  try {
    $proc = Start-Process -FilePath $NodeExe `
      -ArgumentList @('--experimental-sqlite', $Script) `
      -WorkingDirectory $RepoRoot -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $out -RedirectStandardError $err
    foreach ($s in @($out, $err)) {
      if (-not (Test-Path $s)) { continue }
      $c = Get-Content $s -Raw
      if ([string]::IsNullOrWhiteSpace($c)) { continue }
      Add-Content -Path $LogPath -Value $c.TrimEnd("`r", "`n")
    }
    Write-LogLine -Path $LogPath -Message ("{0} exit_code={1}." -f $Label, [int]$proc.ExitCode)
  } catch {
    Write-LogLine -Path $LogPath -Message ("WARN: {0} failed ({1}); ignoring." -f $Label, $_.Exception.Message)
  } finally {
    Remove-Item $out, $err -ErrorAction SilentlyContinue
  }
}

$nodeExe = Resolve-NodeExe -RequestedNodePath $NodePath -RepoRoot $repoRoot
$logRoot = if ($LogDir) { $LogDir } else { Join-Path $agentDir 'logs' }
$null = New-Item -ItemType Directory -Path $logRoot -Force
$logPath = Join-Path $logRoot ("coach-batch-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

Set-Location $repoRoot
$loaded = Import-DotEnv -Path (Join-Path $agentDir '.env.local')
if ($loaded -gt 0) { Write-LogLine -Path $logPath -Message ("Loaded {0} secret(s) from .env.local." -f $loaded) }
Write-LogLine -Path $logPath -Message "START coach batch."

# 1) recall watchdog (verifier over-rejection check), 2) daily coach (night report + metrics)
Invoke-NodeStep -NodeExe $nodeExe -Script (Join-Path $agentDir 'recall-watchdog.mjs') -LogPath $logPath -RepoRoot $repoRoot -Label 'recall watchdog'
Invoke-NodeStep -NodeExe $nodeExe -Script (Join-Path $agentDir 'daily-coach.mjs')     -LogPath $logPath -RepoRoot $repoRoot -Label 'daily coach'

# Mirror the watchdog's alert file to a Desktop marker (present → ensure; absent → remove).
$desktopDir = [Environment]::GetFolderPath('Desktop')
if ($desktopDir) {
  $recallAlertFile = Join-Path $agentDir 'recall-alert.txt'
  $recallMarker = Join-Path $desktopDir 'DRIVECODEX-VERIFIKATOR-PRISNY-PRECTI-ME.txt'
  try {
    if (Test-Path $recallAlertFile) {
      $alertBody = (Get-Content $recallAlertFile -Raw).TrimEnd("`r", "`n")
      $markerText = @"
DriveCodex — verifikator mozna zamita prilis prisne (mozna zahazuje dobre pripady).

$alertBody

Co s tim:
  1. Otevrete Claude Code v projektu C:\GB
  2. Napiste: "zkontroluj recall watchdog"

Tento soubor zmizi sam, jakmile bude dalsi denni kontrola pod prahem.
(Vytvoril: scripts\agent\run-coach-batch.ps1)
"@
      Set-Content -Path $recallMarker -Value $markerText -Encoding utf8
      Write-LogLine -Path $logPath -Message "ALARM: recall watchdog over threshold; desktop marker created."
    } elseif (Test-Path $recallMarker) {
      Remove-Item $recallMarker -Force -ErrorAction SilentlyContinue
      Write-LogLine -Path $logPath -Message "Recall watchdog under threshold; desktop marker removed."
    }
  } catch {
    Write-LogLine -Path $logPath -Message ("WARN: recall marker mirror failed ({0}); ignoring." -f $_.Exception.Message)
  }
}

Write-LogLine -Path $logPath -Message "END coach batch."
