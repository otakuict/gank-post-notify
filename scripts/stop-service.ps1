$ErrorActionPreference = 'Stop'

try {
  $result = Invoke-RestMethod `
    -Method Post `
    -Uri 'http://127.0.0.1:3005/api/shutdown' `
    -TimeoutSec 5

  if (-not $result.ok) {
    throw 'The service rejected the shutdown request.'
  }

  Write-Host 'Stopping Gank Post Notify...'
  $deadline = (Get-Date).AddSeconds(10)
  do {
    Start-Sleep -Milliseconds 250
    try {
      Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3005/health' -TimeoutSec 1 | Out-Null
    } catch {
      Write-Host 'Gank Post Notify stopped successfully.'
      exit 0
    }
  } while ((Get-Date) -lt $deadline)

  throw 'Timed out while waiting for the service to stop.'
} catch {
  try {
    $health = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3005/health' -TimeoutSec 2
    if ($health.service -eq 'gank-post-notify') {
      Write-Host "Could not stop the service: $($_.Exception.Message)"
      exit 1
    }
  } catch {
    Write-Host 'Gank Post Notify is not running.'
    exit 0
  }

  Write-Host 'Port 3005 belongs to another application; it was not stopped.'
  exit 2
}
