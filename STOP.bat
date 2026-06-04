@echo off
title RMD Intelligent Agent - Stopping
color 0C
cls

echo Stopping RMD Agent services...
echo.

taskkill /f /im java.exe   >nul 2>&1 && echo     OK - Backend stopped   || echo     Backend was not running
taskkill /f /im node.exe   >nul 2>&1 && echo     OK - Frontend stopped  || echo     Frontend was not running
taskkill /f /im ollama.exe >nul 2>&1 && echo     OK - Ollama stopped    || echo     Ollama was not running

echo.
echo All services stopped.
timeout /t 2 /nobreak >nul
