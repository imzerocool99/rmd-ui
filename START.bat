@echo off
title RMD Intelligent Agent - Starting
color 0A
cls

echo ============================================
echo    RMD Intelligent Agent - Starting...
echo ============================================
echo.

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "PATH=%JAVA_HOME%\bin;%LOCALAPPDATA%\Programs\Ollama;%USERPROFILE%\maven\apache-maven-3.9.6\bin;%PATH%"

:: Check project exists
if not exist "%USERPROFILE%\rmd-project\rmd-agent\target\rmd-agent-1.0.0.jar" (
    echo    Project not found. Please run SETUP.bat first.
    pause
    exit /b 1
)

:: Start Ollama
echo [1/3] Starting Ollama AI...
start /min "" ollama serve
timeout /t 3 /nobreak >nul
echo     OK - Ollama on port 11434

:: Start Backend
echo [2/3] Starting Backend...
start /min "RMD Backend" cmd /c "java -jar %USERPROFILE%\rmd-project\rmd-agent\target\rmd-agent-1.0.0.jar"
echo     Waiting for backend...
timeout /t 15 /nobreak >nul
echo     OK - Backend on port 8085

:: Start Frontend
echo [3/3] Starting Frontend...
start /min "RMD Frontend" cmd /c "npx http-server %USERPROFILE%\rmd-project\rmd-ui -p 4500 --cors"
timeout /t 4 /nobreak >nul
echo     OK - Frontend on port 4500

echo.
echo ============================================
echo    All services running!
echo    Opening http://localhost:4500
echo ============================================
echo.
start http://localhost:4500
pause
