[CmdletBinding()]
param(
  [switch]$DryRun  # show what would be pushed without applying
)

# Apply pending Supabase migrations to the LINKED project, non-interactively.
# Reads SUPABASE_DB_PASSWORD from scripts/agent/.env.local (or the existing
# environment) so `supabase db push` does not prompt. The password is never
# printed. Idempotent migrations (CREATE TABLE IF NOT EXISTS, etc.) are safe to
# re-run. Run from anywhere; paths resolve relative to this script.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$agentDir = (Resolve-Path $PSScriptRoot).Path
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envFile = Join-Path $agentDir '.env.local'

# Load secrets (KEY=VALUE), without overriding anything already in the env.
if (Test-Path $envFile) {
  foreach ($line in (Get-Content $envFile)) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $eq = $t.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $t.Substring(0, $eq).Trim()
    $val = $t.Substring($eq + 1).Trim().Trim('"').Trim("'")
    if ($key -and [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($key, 'Process'))) {
      Set-Item -Path ("Env:{0}" -f $key) -Value $val
    }
  }
}

if ([string]::IsNullOrEmpty($env:SUPABASE_DB_PASSWORD)) {
  Write-Error "SUPABASE_DB_PASSWORD not set. Fill scripts/agent/.env.local (see .env.local.example)."
  exit 1
}

Set-Location $repoRoot

if ($DryRun) {
  Write-Output "Pending migrations (dry run):"
  & npx --yes supabase db push --linked --dry-run
} else {
  Write-Output "Applying pending migrations to the linked project..."
  & npx --yes supabase db push --linked
}
exit $LASTEXITCODE
