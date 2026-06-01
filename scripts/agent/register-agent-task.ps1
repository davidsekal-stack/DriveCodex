[CmdletBinding()]
param(
  [string]$TaskName = 'DriveCodexAgentBatch',
  [int]$IntervalMinutes = 5,
  [int]$BatchSize = 5,
  [int]$SleepMs = 600,
  [string]$Phase,
  [string]$NodePath,
  [string]$LogDir,
  [switch]$RunNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Quote-TaskArg {
  param([string]$Value)
  return '"' + $Value.Replace('"', '\"') + '"'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runnerScript = (Resolve-Path (Join-Path $PSScriptRoot 'run-agent-batch.ps1')).Path
$powershellExe = (Get-Command powershell.exe -ErrorAction Stop).Path
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$argParts = @(
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  (Quote-TaskArg $runnerScript),
  '-BatchSize',
  [string]$BatchSize,
  '-SleepMs',
  [string]$SleepMs
)

if ($Phase) {
  $argParts += @('-Phase', (Quote-TaskArg $Phase))
}

if ($NodePath) {
  $resolvedNode = (Resolve-Path $NodePath -ErrorAction Stop).Path
  $argParts += @('-NodePath', (Quote-TaskArg $resolvedNode))
}

if ($LogDir) {
  $resolvedLogDir = [System.IO.Path]::GetFullPath($LogDir)
  $argParts += @('-LogDir', (Quote-TaskArg $resolvedLogDir))
}

$action = New-ScheduledTaskAction `
  -Execute $powershellExe `
  -Argument ($argParts -join ' ') `
  -WorkingDirectory $repoRoot

$startAt = (Get-Date).AddMinutes(1)
$repeat = New-TimeSpan -Minutes $IntervalMinutes
$repeatDuration = New-TimeSpan -Days 3650

$onceTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At $startAt `
  -RepetitionInterval $repeat `
  -RepetitionDuration $repeatDuration

$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 5)

$principal = New-ScheduledTaskPrincipal `
  -UserId $currentUser `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($onceTrigger, $logonTrigger) `
  -Settings $settings `
  -Principal $principal `
  -Description 'DriveCodex autonomous crawl agent batch runner' `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

$info = Get-ScheduledTaskInfo -TaskName $TaskName
[pscustomobject]@{
  TaskName = $TaskName
  User = $currentUser
  NextRunTime = $info.NextRunTime
  LastRunTime = $info.LastRunTime
  LastTaskResult = $info.LastTaskResult
  IntervalMinutes = $IntervalMinutes
  BatchSize = $BatchSize
  SleepMs = $SleepMs
  Phase = $Phase
}
