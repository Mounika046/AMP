$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $Root ".runtime"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$BackendLog = Join-Path $RuntimeDir "backend.log"
$BackendErrLog = Join-Path $RuntimeDir "backend.err.log"
$FrontendLog = Join-Path $RuntimeDir "frontend.log"
$FrontendErrLog = Join-Path $RuntimeDir "frontend.err.log"
$PidFile = Join-Path $RuntimeDir "pids.json"

if (Test-Path $BackendLog) { Clear-Content $BackendLog }
if (Test-Path $BackendErrLog) { Clear-Content $BackendErrLog }
if (Test-Path $FrontendLog) { Clear-Content $FrontendLog }
if (Test-Path $FrontendErrLog) { Clear-Content $FrontendErrLog }

$Backend = Start-Process -FilePath "node" `
  -ArgumentList "backend/server.js" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $BackendLog `
  -RedirectStandardError $BackendErrLog `
  -PassThru

$Frontend = Start-Process -FilePath "node" `
  -ArgumentList "frontend/server.js" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $FrontendLog `
  -RedirectStandardError $FrontendErrLog `
  -PassThru

@{
  backend = $Backend.Id
  frontend = $Frontend.Id
  backendUrl = "http://localhost:4188"
  frontendUrl = "http://localhost:5288"
} | ConvertTo-Json | Set-Content -Path $PidFile

Write-Host "L1 HelpDesk prototype started."
Write-Host "Frontend: http://localhost:5288"
Write-Host "Backend:  http://localhost:4188/api/health"
Write-Host "Logs:     $RuntimeDir"
