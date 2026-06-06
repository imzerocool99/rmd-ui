# RMD Demo Startup Script
# Run this before your demo: right-click → "Run with PowerShell"
# Starts the Spring Boot backend + verifies the frontend is reachable

$JAR    = "C:\Users\Dynabook\rmd-agent\target\rmd-agent-1.0.0.jar"
$FRONT  = "http://localhost:4500"
$BACK   = "http://localhost:8085"
$JAVA   = "java"

Write-Host ""
Write-Host "=== RMD Demo Startup ===" -ForegroundColor Cyan

# ── 1. Kill any stale Java processes ─────────────────────────────────
$existing = Get-Process java -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping existing Java process..." -ForegroundColor Yellow
    $existing | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# ── 2. Verify JAR exists ──────────────────────────────────────────────
if (-not (Test-Path $JAR)) {
    Write-Host "JAR not found at $JAR" -ForegroundColor Red
    Write-Host "Rebuilding backend..." -ForegroundColor Yellow
    & "C:\Users\Dynabook\maven\apache-maven-3.9.6\bin\mvn.cmd" -f "C:\Users\Dynabook\rmd-agent\pom.xml" clean package -DskipTests -q
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build FAILED. Demo will run on fallback data only." -ForegroundColor Red
    } else {
        Write-Host "Build succeeded." -ForegroundColor Green
    }
}

# ── 3. Start backend ──────────────────────────────────────────────────
if (Test-Path $JAR) {
    Write-Host "Starting Spring Boot backend..." -ForegroundColor Cyan
    Start-Process $JAVA -ArgumentList "-jar", $JAR -WindowStyle Hidden

    # Wait up to 20s for it to come up
    $ready = $false
    for ($i = 1; $i -le 10; $i++) {
        Start-Sleep -Seconds 2
        try {
            $r = Invoke-WebRequest -Uri "$BACK/agent/portfolio" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            $ready = $true
            break
        } catch { }
        Write-Host "  Waiting for backend... ($($i*2)s)" -ForegroundColor DarkGray
    }

    if ($ready) {
        Write-Host "Backend is UP on port 8085" -ForegroundColor Green
    } else {
        Write-Host "Backend did not respond in 20s — demo will use fallback data automatically." -ForegroundColor Yellow
    }
} else {
    Write-Host "Skipping backend (JAR missing) — demo will use fallback data." -ForegroundColor Yellow
}

# ── 4. Check frontend ─────────────────────────────────────────────────
try {
    $r = Invoke-WebRequest -Uri $FRONT -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "Frontend is UP on port 4500" -ForegroundColor Green
} catch {
    Write-Host "Frontend not detected on port 4500" -ForegroundColor Yellow
    Write-Host "Start it with: npx serve -l 4500 C:\Users\Dynabook\rmd-ui" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Ready for demo ===" -ForegroundColor Green
Write-Host "Open: $FRONT" -ForegroundColor White
Write-Host ""
Write-Host "NOTE: If the backend goes down mid-demo, the UI automatically" -ForegroundColor DarkGray
Write-Host "      switches to demo fallback data — the presentation continues." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Press Enter to close this window"
