# ============================================================
#  RMD Intelligent Agent - One-Click Setup
#  Run this ONCE on a new machine to install and launch the app
#  Right-click Run with PowerShell
# ============================================================

$ErrorActionPreference = "Stop"
$HOST.UI.RawUI.WindowTitle = "RMD Agent Setup"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-WARN($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }

Clear-Host
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "   RMD Intelligent Agent - Setup Wizard    " -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# 1. Check winget
Write-Step "Checking package manager..."
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-WARN "winget not found. Please install App Installer from the Microsoft Store and re-run."
    Pause; exit 1
}
Write-OK "winget is available"

# 2. Install Java 17
Write-Step "Checking Java 17..."
$javaHome = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
if (-not (Test-Path "$javaHome\bin\java.exe")) {
    Write-Host "    Installing Java 17 (this may take a few minutes)..." -ForegroundColor Yellow
    winget install Microsoft.OpenJDK.17 --accept-package-agreements --accept-source-agreements --silent
    Write-OK "Java 17 installed"
} else {
    Write-OK "Java 17 already installed"
}
$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

# 3. Install Git
Write-Step "Checking Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "    Installing Git..." -ForegroundColor Yellow
    winget install Git.Git --accept-package-agreements --accept-source-agreements --silent
    $env:PATH = "C:\Program Files\Git\cmd;$env:PATH"
    Write-OK "Git installed"
} else {
    Write-OK "Git already installed"
}

# 4. Install Node.js
Write-Step "Checking Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "    Installing Node.js..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements --silent
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
    Write-OK "Node.js installed"
} else {
    Write-OK "Node.js already installed - $(node -v)"
}

# 5. Install Ollama
Write-Step "Checking Ollama (local AI)..."
$ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (-not (Test-Path $ollamaPath)) {
    Write-Host "    Installing Ollama..." -ForegroundColor Yellow
    winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements --silent
    Write-OK "Ollama installed"
} else {
    Write-OK "Ollama already installed"
}
$env:PATH = "$env:LOCALAPPDATA\Programs\Ollama;$env:PATH"

# 6. Pull Phi-3 AI model
Write-Step "Checking Phi-3 AI model (3.8GB download if not present)..."
$models = & ollama list 2>&1
if ($models -notmatch "phi3") {
    Write-Host "    Downloading Phi-3 model (3.8GB, please wait)..." -ForegroundColor Yellow
    ollama pull phi3
    Write-OK "Phi-3 model ready"
} else {
    Write-OK "Phi-3 model already downloaded"
}

# 7. Install Maven
Write-Step "Checking Maven..."
$mvnPath = "$env:USERPROFILE\maven\apache-maven-3.9.6\bin\mvn.cmd"
if (-not (Test-Path $mvnPath)) {
    Write-Host "    Downloading Maven 3.9.6..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://archive.apache.org/dist/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip" `
        -OutFile "$env:USERPROFILE\maven.zip" -UseBasicParsing
    Expand-Archive "$env:USERPROFILE\maven.zip" -DestinationPath "$env:USERPROFILE\maven" -Force
    Remove-Item "$env:USERPROFILE\maven.zip"
    Write-OK "Maven installed"
} else {
    Write-OK "Maven already installed"
}
$env:PATH = "$env:USERPROFILE\maven\apache-maven-3.9.6\bin;$env:PATH"

# 8. Clone repos
Write-Step "Setting up project files..."
$projectDir = "$env:USERPROFILE\rmd-project"
if (-not (Test-Path $projectDir)) { New-Item -ItemType Directory -Path $projectDir | Out-Null }
Set-Location $projectDir

if (-not (Test-Path "$projectDir\rmd-agent")) {
    Write-Host "    Cloning backend..." -ForegroundColor Yellow
    git clone https://github.com/imzerocool99/rmd-agent.git
    Set-Location "$projectDir\rmd-agent"; git checkout feature/local-poc-ui
    Set-Location $projectDir
    Write-OK "Backend cloned"
} else {
    Write-Host "    Updating backend..." -ForegroundColor Yellow
    Set-Location "$projectDir\rmd-agent"; git pull; git checkout feature/local-poc-ui
    Set-Location $projectDir
    Write-OK "Backend updated"
}

if (-not (Test-Path "$projectDir\rmd-ui")) {
    Write-Host "    Cloning frontend..." -ForegroundColor Yellow
    git clone https://github.com/imzerocool99/rmd-ui.git
    Set-Location "$projectDir\rmd-ui"; git checkout feature/local-poc-ui
    Set-Location $projectDir
    Write-OK "Frontend cloned"
} else {
    Write-Host "    Updating frontend..." -ForegroundColor Yellow
    Set-Location "$projectDir\rmd-ui"; git pull; git checkout feature/local-poc-ui
    Set-Location $projectDir
    Write-OK "Frontend updated"
}

# 9. Build backend
Write-Step "Building backend (first build downloads dependencies 100MB)..."
Set-Location "$projectDir\rmd-agent"
mvn clean package -DskipTests -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "    BUILD FAILED. Check your internet connection and try again." -ForegroundColor Red
    Pause; exit 1
}
Write-OK "Backend built successfully"

# 10. Install frontend dependencies
Write-Step "Installing frontend dependencies..."
Set-Location "$projectDir\rmd-ui"
npm install --silent
Write-OK "Frontend dependencies installed"

# 11. Launch all services
Write-Step "Starting all services..."

# Start Ollama
Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
Start-Sleep -Seconds 3
Write-OK "Ollama AI running on port 11434"

# Start Backend
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "java -jar $projectDir\rmd-agent\target\rmd-agent-1.0.0.jar" `
    -WindowStyle Minimized
Write-Host "    Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 18
Write-OK "Backend running on port 8085"

# Start Frontend
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npx http-server $projectDir\rmd-ui -p 4500 --cors" `
    -WindowStyle Minimized
Start-Sleep -Seconds 4
Write-OK "Frontend running on port 4500"

# 12. Open browser
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Setup Complete! Opening the app...      " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   App URL  : http://localhost:4500" -ForegroundColor White
Write-Host "   API URL  : http://localhost:8085" -ForegroundColor White
Write-Host "   AI URL   : http://localhost:11434" -ForegroundColor White
Write-Host ""
Write-Host "   To start the app next time, run START.ps1" -ForegroundColor Yellow
Write-Host ""

Start-Process "http://localhost:4500"
Pause
