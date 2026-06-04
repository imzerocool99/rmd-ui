@echo off
setlocal EnableDelayedExpansion
title RMD Intelligent Agent - Setup
color 0A
cls

echo ============================================
echo    RMD Intelligent Agent - Setup Wizard
echo ============================================
echo.
echo  This will install everything automatically
echo  and launch the app when done.
echo.
echo  First run takes 10-15 minutes.
echo  Do NOT close this window.
echo.
pause

:: ── Check winget ─────────────────────────────────────────────
echo.
echo [1/9] Checking package manager (winget)...
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: winget not found.
    echo  Please install "App Installer" from the Microsoft Store
    echo  then re-run this file.
    echo.
    pause
    exit /b 1
)
echo     OK - winget is available

:: ── Install Git ──────────────────────────────────────────────
echo.
echo [2/9] Checking Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo     Installing Git...
    winget install Git.Git --accept-package-agreements --accept-source-agreements --silent
    set "PATH=C:\Program Files\Git\cmd;%PATH%"
    echo     OK - Git installed
) else (
    echo     OK - Git already installed
)

:: ── Install Java 17 ──────────────────────────────────────────
echo.
echo [3/9] Checking Java 17...
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
if exist "%JAVA_HOME%\bin\java.exe" (
    echo     OK - Java 17 already installed
) else (
    echo     Installing Java 17 - please wait...
    winget install Microsoft.OpenJDK.17 --accept-package-agreements --accept-source-agreements --silent
    echo     OK - Java 17 installed
)
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: ── Install Node.js ──────────────────────────────────────────
echo.
echo [4/9] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo     Installing Node.js...
    winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements --silent
    set "PATH=C:\Program Files\nodejs;%PATH%"
    echo     OK - Node.js installed
) else (
    echo     OK - Node.js already installed
)

:: ── Install Ollama ───────────────────────────────────────────
echo.
echo [5/9] Checking Ollama (local AI engine)...
set "OLLAMA_PATH=%LOCALAPPDATA%\Programs\Ollama"
if exist "%OLLAMA_PATH%\ollama.exe" (
    echo     OK - Ollama already installed
) else (
    echo     Installing Ollama...
    winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements --silent
    echo     OK - Ollama installed
)
set "PATH=%OLLAMA_PATH%;%PATH%"

:: ── Pull Phi-3 AI model ──────────────────────────────────────
echo.
echo [6/9] Checking Phi-3 AI model...
echo     (If not downloaded, this will take a while - 3.8GB)
ollama list 2>nul | findstr /i "phi3" >nul
if %errorlevel% neq 0 (
    echo     Downloading Phi-3 model - please wait...
    ollama pull phi3
    echo     OK - Phi-3 model downloaded
) else (
    echo     OK - Phi-3 already downloaded
)

:: ── Install Maven ────────────────────────────────────────────
echo.
echo [7/9] Checking Maven (Java build tool)...
set "MVN_HOME=%USERPROFILE%\maven\apache-maven-3.9.6"
if exist "%MVN_HOME%\bin\mvn.cmd" (
    echo     OK - Maven already installed
) else (
    echo     Downloading Maven 3.9.6...
    curl -L -o "%USERPROFILE%\maven.zip" "https://archive.apache.org/dist/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip" --ssl-no-revoke
    if not exist "%USERPROFILE%\maven" mkdir "%USERPROFILE%\maven"
    tar -xf "%USERPROFILE%\maven.zip" -C "%USERPROFILE%\maven"
    del "%USERPROFILE%\maven.zip"
    echo     OK - Maven installed
)
set "PATH=%MVN_HOME%\bin;%PATH%"

:: ── Clone / Update Repos ─────────────────────────────────────
echo.
echo [8/9] Setting up project from GitHub...
set "PROJECT_DIR=%USERPROFILE%\rmd-project"
if not exist "%PROJECT_DIR%" mkdir "%PROJECT_DIR%"
cd /d "%PROJECT_DIR%"

if not exist "%PROJECT_DIR%\rmd-agent" (
    echo     Cloning backend...
    git clone https://github.com/imzerocool99/rmd-agent.git
    cd rmd-agent
    git checkout feature/local-poc-ui
    cd ..
) else (
    echo     Updating backend...
    cd rmd-agent
    git pull
    git checkout feature/local-poc-ui
    cd ..
)

if not exist "%PROJECT_DIR%\rmd-ui" (
    echo     Cloning frontend...
    git clone https://github.com/imzerocool99/rmd-ui.git
    cd rmd-ui
    git checkout feature/local-poc-ui
    cd ..
) else (
    echo     Updating frontend...
    cd rmd-ui
    git pull
    git checkout feature/local-poc-ui
    cd ..
)
echo     OK - Project ready

:: ── Build Backend ────────────────────────────────────────────
echo.
echo     Building backend (downloads ~100MB on first run)...
cd /d "%PROJECT_DIR%\rmd-agent"
call "%MVN_HOME%\bin\mvn.cmd" clean package -DskipTests -q
if %errorlevel% neq 0 (
    echo.
    echo  BUILD FAILED. Check your internet and try again.
    pause
    exit /b 1
)
echo     OK - Backend built successfully

:: ── Install Frontend Dependencies ────────────────────────────
cd /d "%PROJECT_DIR%\rmd-ui"
call npm install --silent
echo     OK - Frontend dependencies installed

:: ── Launch All Services ──────────────────────────────────────
echo.
echo [9/9] Starting all services...

start /min "" "%OLLAMA_PATH%\ollama.exe" serve
timeout /t 3 /nobreak >nul
echo     OK - Ollama AI on port 11434

start /min "RMD Backend" "%JAVA_HOME%\bin\java.exe" -jar "%PROJECT_DIR%\rmd-agent\target\rmd-agent-1.0.0.jar"
echo     Waiting for backend to start (18 seconds)...
timeout /t 18 /nobreak >nul
echo     OK - Backend on port 8085

start /min "RMD Frontend" cmd /k npx http-server "%PROJECT_DIR%\rmd-ui" -p 4500 --cors
timeout /t 5 /nobreak >nul
echo     OK - Frontend on port 4500

:: ── Done ─────────────────────────────────────────────────────
echo.
echo ============================================
echo    Setup Complete! Opening the app...
echo ============================================
echo.
echo    App URL : http://localhost:4500
echo    API URL : http://localhost:8085
echo.
echo    Next time just double-click START.bat
echo.
start http://localhost:4500
echo.
pause
