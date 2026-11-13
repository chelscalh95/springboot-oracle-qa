<#
.SYNOPSIS
  Runs the JMeter plan in non-GUI mode and writes results plus an HTML dashboard to qa/performance/results/.
  AUTHORED BUT NEVER EXECUTED: no JMeter, application or Oracle was available when this was written.

.EXAMPLE
  .\run-jmeter.ps1 -Profile smoke
  .\run-jmeter.ps1 -Profile load -ApiHost localhost -Port 8080
#>
param(
    [ValidateSet('smoke', 'load', 'stress')]
    [string]$Profile = 'smoke',
    [string]$ApiHost = 'localhost',
    [int]$Port = 8080,
    [string]$JMeterHome = $env:JMETER_HOME
)

$ErrorActionPreference = 'Stop'

if ($JMeterHome) {
    $jmeter = Join-Path $JMeterHome 'bin\jmeter.bat'
    if (-not (Test-Path $jmeter)) { throw "JMeter not found at $jmeter. Set JMETER_HOME or pass -JMeterHome." }
} else {
    $jmeter = 'jmeter'
    if (-not (Get-Command $jmeter -ErrorAction SilentlyContinue)) {
        throw "JMeter not found. Install it, then set JMETER_HOME or add its bin folder to PATH."
    }
}

$plan  = Join-Path $PSScriptRoot 'jmeter\springboot-oracle-load-test.jmx'
$props = Join-Path $PSScriptRoot "jmeter\profiles\$Profile.properties"
$out   = Join-Path $PSScriptRoot ("results\{0}-{1}" -f $Profile, (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $out | Out-Null

# A load test against a target that is not answering proves nothing, so check first.
$url = "http://${ApiHost}:${Port}/data-app/individuals"
try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 | Out-Null
} catch {
    throw "Application not reachable at $url. Start it first. $($_.Exception.Message)"
}

Write-Host "Profile: $Profile   Target: $url   Output: $out"
& $jmeter -n -t $plan -q $props "-Jhost=$ApiHost" "-Jport=$Port" `
    -l (Join-Path $out 'results.jtl') -j (Join-Path $out 'jmeter.log') `
    -e -o (Join-Path $out 'dashboard')
if ($LASTEXITCODE -ne 0) { throw "JMeter exited with code $LASTEXITCODE. See $out\jmeter.log" }

# JMeter exits 0 even when assertions fail, so evaluate the results file ourselves.
$rows = @(Import-Csv (Join-Path $out 'results.jtl'))
if ($rows.Count -eq 0) { throw "No samples were recorded. See $out\jmeter.log" }

$rows | Group-Object label | ForEach-Object {
    $elapsed = @($_.Group | ForEach-Object { [int]$_.elapsed } | Sort-Object)
    $p95 = $elapsed[[math]::Min($elapsed.Count - 1, [int][math]::Ceiling(0.95 * $elapsed.Count) - 1)]
    [pscustomobject]@{
        Label   = $_.Name
        Samples = $_.Count
        Failed  = @($_.Group | Where-Object { $_.success -eq 'false' }).Count
        AvgMs   = [math]::Round(($elapsed | Measure-Object -Average).Average)
        P95Ms   = $p95
    }
} | Format-Table -AutoSize

$failed = @($rows | Where-Object { $_.success -eq 'false' }).Count
Write-Host ("Total samples: {0}   Failed: {1}" -f $rows.Count, $failed)
Write-Host "Dashboard: $(Join-Path $out 'dashboard\index.html')"
Write-Host "Clean up the test data afterwards:  cd qa ; npm run db:cleanup -- --yes"
if ($failed -gt 0) { exit 1 }
