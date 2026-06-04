@echo off
title RMD Intelligent Agent - Setup
color 0A
cls

echo ============================================
echo    RMD Intelligent Agent - Setup Wizard
echo ============================================
echo.
echo  This will install everything and launch the app.
echo  First run takes 10-15 minutes (downloads ~4GB).
echo  Please keep this window open.
echo.
pause

:: ── Check winget ─────────────────────────────
echo.
echo [1/9] Checking package manager...
where winget >nul 2>&1
if %errorlevel% neq 0 (
    echo     ERROR: winget not found.
    echo     Please install "App Installer" from Microsoft Store and re-run.
    pause
    exit /b 1
)
echo     OK - winget available

:: ── Install Git ──────────────────────────────
echo.
echo [2/9] Checking Git...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo     Installing Git...
    winget install Git.Git --accept-package-agreements --accept-source-agreements --silent
    set "PATH=C:\Program Files\Git\cmd;%PATH%"
    echo     OK - Git installed
) else (
    echo     OK - Git already installed
)

:: ── Install Java 17 ──────────────────────────
echo.
echo [3/9] Checking Java 17...
if exist "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\bin\java.exe" (
    echo     OK - Java 17 already installed
) else (
    echo     Installing Java 17 (this may take a few minutes)...
    winget install Microsoft.OpenJDK.17 --accept-package-agreements --accept-source-agreements --silent
    echo     OK - Java 17 installed
)
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: ── Install Node.js ──────────────────────────
echo.
echo [4/9] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo     Installing Node.js...
    winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements --silent
    set "PATH=C:\Program Files\nodejs;%PATH%"
    echo     OK - Node.js installed
) else (
    echo     OK - Node.js already installed
)

:: ── Install Ollama ───────────────────────────
echo.
echo [5/9] Checking Ollama (local AI)...
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    echo     OK - Ollama already installed
) else (
    echo     Installing Ollama...
    winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements --silent
    echo     OK - Ollama installed
)
set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"

:: ── Pull Phi-3 model ─────────────────────────
echo.
echo [6/9] Checking Phi-3 AI model (3.8GB download if not present)...
ollama list 2>nul | findstr /i "phi3" >nul
if %errorlevel% neq 0 (
    echo     Downloading Phi-3 model - please wait, this is a large file...
    ollama pull phi3
    echo     OK - Phi-3 model ready
) else (
    echo     OK - Phi-3 already downloaded
)

:: ── Install Maven ────────────────────────────
echo.
echo [7/9] Checking Maven...
if exist "%USERPROFILE%\maven\apache-maven-3.9.6\bin\mvn.cmd" (
    echo     OK - Maven already installed
) else (
    echo     Downloading Maven 3.9.6...
    powershell -Command "Invoke-WebRequest -Uri 'https://archive.apache.org/dist/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip' -OutFile '%USERPROFILE%\maven.zip' -UseBasicParsing"
    powershell -Command "Expand-Archive '%USERPROFILE%\maven.zip' -DestinationPath '%USERPROFILE%\maven' -Force"
    del "%USERPROFILE%\maven.zip"
    echo     OK - Maven installed
)
set "PATH=%USERPROFILE%\maven\apache-maven-3.9.6\bin;%PATH%"

:: ── Clone Repos ──────────────────────────────
echo.
echo [8/9] Setting up project files...
if not exist "%USERPROFILE%\rmd-project" mkdir "%USERPROFILE%\rmd-project"
cd /d "%USERPROFILE%\rmd-project"

if not exist "rmd-agent" (
    echo     Cloning backend from GitHub...
    git clone https://github.com/imzerocool99/rmd-agent.git
    cd rmd-agent && git checkout feature/local-poc-ui && cd ..
    echo     OK - Backend cloned
) else (
    echo     Updating backend...
    cd rmd-agent && git pull && git checkout feature/local-poc-ui && cd ..
    echo     OK - Backend updated
)

if not exist "rmd-ui" (
    echo     Cloning frontend from GitHub...
    git clone https://github.com/imzerocool99/rmd-ui.git
    cd rmd-ui && git checkout feature/local-poc-ui && cd ..
    echo     OK - Frontend cloned
) else (
    echo     Updating frontend...
    cd rmd-ui && git pull && git checkout feature/local-poc-ui && cd ..
    echo     OK - Frontend updated
)

:: ── Build Backend ────────────────────────────
echo.
echo     Building backend (first build downloads ~100MB)...
cd /d "%USERPROFILE%\rmd-project\rmd-agent"
call mvn clean package -DskipTests -q
if %errorlevel% neq 0 (
    echo     BUILD FAILED. Check internet and try again.
    pause
    exit /b 1
)
echo     OK - Backend built

:: ── Install frontend deps ────────────────────
cd /d "%USERPROFILE%\rmd-project\rmd-ui"
call npm install --silent
echo     OK - Frontend ready

:: ── Launch Services ──────────────────────────
echo.
echo [9/9] Starting all services...

start /min "" ollama serve
timeout /t 3 /nobreak >nul
echo     OK - Ollama AI on port 11434

start /min "RMD Backend" cmd /c "java -jar %USERPROFILE%\rmd-project\rmd-agent\target\rmd-agent-1.0.0.jar"
echo     Waiting for backend to start...
timeout /t 18 /nobreak >nul
echo     OK - Backend on port 8085

start /min "RMD Frontend" cmd /c "npx http-server %USERPROFILE%\rmd-project\rmd-ui -p 4500 --cors"
timeout /t 4 /nobreak >nul
echo     OK - Frontend on port 4500

:: ── Done ─────────────────────────────────────
echo.
echo ============================================
echo    Setup Complete!
echo ============================================
echo.
echo    App URL : http://localhost:4500
echo    API URL : http://localhost:8085
echo.
echo    Next time just double-click START.bat
echo.
start http://localhost:4500
pause
