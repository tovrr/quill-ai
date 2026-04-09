$port = 3000
$routes = @("/", "/agent", "/api/me/entitlements")

Write-Host "Testing Routes on Port $port"
foreach ($route in $routes) {
    $url = "http://localhost:$port$route"
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 5
        Write-Host "GET $route : $($response.StatusCode)"
    } catch {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            Write-Host "GET $route : $statusCode"
        } else {
            Write-Host "GET $route : ERROR"
        }
    }
}
