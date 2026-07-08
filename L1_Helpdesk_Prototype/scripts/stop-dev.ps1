$ErrorActionPreference = "SilentlyContinue"

$Root = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $Root ".runtime\pids.json"

if (!(Test-Path $PidFile)) {
  Write-Host "No prototype PID file found."
  exit 0
}

$Pids = Get-Content -Raw -Path $PidFile | ConvertFrom-Json
foreach ($PidValue in @($Pids.backend, $Pids.frontend)) {
  if ($PidValue) {
    Stop-Process -Id $PidValue -Force
  }
}

Remove-Item -Path $PidFile
Write-Host "L1 HelpDesk prototype stopped."
