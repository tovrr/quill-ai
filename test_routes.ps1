$ProgressPreference = 'SilentlyContinue'
try { $r1 = (Invoke-WebRequest -Uri 'http://localhost:3001/' -UseBasicParsing -TimeoutSec 3).StatusCode } catch { $r1 = 'ERROR' }
try { $r2 = (Invoke-WebRequest -Uri 'http://localhost:3001/api' -UseBasicParsing -TimeoutSec 3).StatusCode } catch { $r2 = 'ERROR' }
try { $r3 = (Invoke-WebRequest -Uri 'http://localhost:3001/favicon.ico' -UseBasicParsing -TimeoutSec 3).StatusCode } catch { $r3 = 'ERROR' }
Write-Output "Route 1 - Status: $r1"
Write-Output "Route 2 - Status: $r2"
Write-Output "Route 3 - Status: $r3"
