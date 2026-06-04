@echo off
title RMD Intelligent Agent - Start
color 0A
echo.
echo  Starting RMD Agent...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0START.ps1"
