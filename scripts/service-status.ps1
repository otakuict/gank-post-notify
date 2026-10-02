$ErrorActionPreference = 'Stop'

try {
  $health = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3005/health' -TimeoutSec 2
  if ($health.service -eq 'gank-post-notify') {
    Write-Host 'Gank Post Notify is already running on port 3005.'
    exit 0
  }

  Write-Host 'Port 3005 is being used by another application.'
  exit 2
} catch {
  if ($_.Exception.Response) {
    Write-Host 'Port 3005 responded, but it is not Gank Post Notify.'
    exit 2
  }
  exit 1
}
