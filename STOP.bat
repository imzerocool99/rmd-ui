@echo off
title RMD Intelligent Agent - Stop
color 0C
echo.
echo  Stopping RMD Agent services...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0STOP.ps1"
