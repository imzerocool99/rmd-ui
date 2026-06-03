# ============================================================
#  RMD Intelligent Agent — Start Services
#  Run this every time you want to launch the app
#  Right-click → Run with PowerShell
# ============================================================

$HOST.UI.RawUI.WindowTitle = "RMD Agent"
$projectDir = "$env:USERPROFILE\rmd-project"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }

Clear-Host
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "   RMD Intelligent Agent — Starting...     " -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# Set paths
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:LOCALAPPDATA\Programs\Ollama;$env:PATH"

# Check project exists
if (-not (Test-Path "$projectDir\rmd-agent\target\rmd-agent-1.0.0.jar")) {
    Write-Host ""
    Write-Host "   Project not found. Please run SETUP.ps1 first." -ForegroundColor Red
    Pause; exit 1
}

# Start Ollama
Write-Step "Starting Ollama AI..."
$ollama = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if (-not $ollama) {
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}
Write-OK "Ollama running on port 11434"

# Start Backend
Write-Step "Starting Backend..."
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "java -jar $projectDir\rmd-agent\target\rmd-agent-1.0.0.jar" `
    -WindowStyle Minimized
Write-Host "    Waiting for backend..." -ForegroundColor Yellow
Start-Sleep -Seconds 15
Write-OK "Backend running on port 8085"

# Start Frontend
Write-Step "Starting Frontend..."
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npx http-server $projectDir\rmd-ui -p 4500 --cors" `
    -WindowStyle Minimized
Start-Sleep -Seconds 4
Write-OK "Frontend running on port 4500"

# Open browser
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   All services running!                   " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Open browser : http://localhost:4500" -ForegroundColor White
Write-Host ""
Start-Process "http://localhost:4500"
Pause
