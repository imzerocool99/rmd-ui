# ============================================================
#  RMD Intelligent Agent — Start Services
#  Run this every time you want to launch the app
#  Right-click → Run with PowerShell (or double-click START.bat)
# ============================================================

$HOST.UI.RawUI.WindowTitle = "RMD Agent"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }

Clear-Host
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "   RMD Intelligent Agent - Starting...     " -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# Set Java and Ollama in PATH
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:LOCALAPPDATA\Programs\Ollama;$env:PATH"

# Find project directory (searches multiple locations)
$projectDir = ""
$candidates = @(
    "$env:USERPROFILE\rmd-project",
    "$env:USERPROFILE",
    "C:\Users\Dynabook"
)
foreach ($c in $candidates) {
    if (Test-Path "$c\rmd-agent\target\rmd-agent-1.0.0.jar") {
        $projectDir = $c; break
    }
}

if (-not $projectDir) {
    Write-Host ""
    Write-Host "   Project not found. Please run SETUP.bat first." -ForegroundColor Red
    Pause; exit 1
}

$jarPath = "$projectDir\rmd-agent\target\rmd-agent-1.0.0.jar"
$uiDir   = if (Test-Path "$projectDir\rmd-ui\index.html") { "$projectDir\rmd-ui" } else { "$env:USERPROFILE\rmd-ui" }

Write-Host "   Project : $projectDir" -ForegroundColor DarkGray

# ── Start Ollama ─────────────────────────────
Write-Step "Starting Ollama AI..."
if (-not (Get-Process -Name "ollama" -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}
Write-OK "Ollama on port 11434"

# ── Start Backend ────────────────────────────
Write-Step "Starting Backend..."
Start-Process -FilePath "java" -ArgumentList "-jar", $jarPath -WindowStyle Minimized
Write-Host "    Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 18
Write-OK "Backend on port 8085"

# ── Start Frontend ───────────────────────────
Write-Step "Starting Frontend..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npx http-server `"$uiDir`" -p 4500 --cors" -WindowStyle Minimized
Start-Sleep -Seconds 5
Write-OK "Frontend on port 4500"

# ── Open Browser ─────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   All services running!                   " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   App URL : http://localhost:4500" -ForegroundColor White
Write-Host "   API URL : http://localhost:8085" -ForegroundColor White
Write-Host ""
Start-Process "http://localhost:4500"
Pause
